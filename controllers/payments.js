const express = require("express");
const { body, param, validationResult } = require("express-validator");
const Stripe = require("stripe");
const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const { authenticateToken } = require("../middleware/auth");
const dailyService = require("../services/daily/dailyService");

const router = express.Router();

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// Helper function to determine pricing based on country
const getPricingForCountry = (country) => {
  const pricingConfig = {
    Bulgaria: {
      amount: 6000, // Amount in stotinki (60 BGN)
      currency: "BGN",
      priceId: process.env.STRIPE_PRICE_ID_BGN,
    },
    Germany: {
      amount: 6000, // Amount in cents (60 EUR)
      currency: "EUR",
      priceId: process.env.STRIPE_PRICE_ID_EUR,
    },
  };

  return pricingConfig[country] || pricingConfig.Germany; // Default to Germany if country not found
};

// Helper function to detect country from user data or request
const detectUserCountry = (user, req) => {
  // Check if user has country information
  if (user.country) {
    return user.country;
  }

  // Check for country in request headers or other sources
  const acceptLanguage = req.headers["accept-language"];
  if (acceptLanguage && acceptLanguage.includes("bg")) {
    return "Bulgaria";
  }

  // Default to Germany
  return "Germany";
};

// Validation rules for create session
const createSessionValidationRules = [
  body("doctorId").isMongoId().withMessage("Valid doctor ID is required"),
  body("date")
    .isISO8601()
    .withMessage("Valid date is required")
    .custom((value) => {
      const appointmentDate = new Date(value + "T00:00:00.000Z");
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);

      if (appointmentDate < todayUTC) {
        throw new Error("Date cannot be in the past");
      }
      return true;
    }),
  body("slot")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Slot must be in HH:MM format"),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must not exceed 500 characters"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes must not exceed 1000 characters"),
  body("country")
    .optional()
    .isIn(["Bulgaria", "Germany"])
    .withMessage("Country must be Bulgaria or Germany"),
];

// POST /api/payments/create-session - Create Stripe checkout session
router.post(
  "/create-session",
  authenticateToken,
  createSessionValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        doctorId,
        date,
        slot,
        reason,
        notes,
        country: requestCountry,
      } = req.body;
      const patientId = req.user._id.toString();

      // Verify patient exists
      const patient = await User.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      // Verify doctor exists and is active
      const doctor = await Doctor.findById(doctorId);
      if (!doctor || !doctor.isActive) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found or inactive",
        });
      }

      // Parse appointment date as UTC
      const appointmentDateUTC = new Date(date + "T00:00:00.000Z");

      // Check if slot is still available
      const existingAppointment = await Appointment.findOne({
        doctorId,
        date: appointmentDateUTC,
        slot,
        status: { $in: ["pending_payment", "upcoming"] },
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message: "Time slot is no longer available",
        });
      }

      // Determine country and pricing
      const userCountry = requestCountry || detectUserCountry(patient, req);
      const pricing = getPricingForCountry(userCountry);

      // Create temporary appointment record with pending payment status
      const tempAppointment = new Appointment({
        patientId,
        doctorId,
        date: appointmentDateUTC,
        slot,
        plan: "consultation",
        reason: reason || "General consultation",
        notes: notes || "",
        status: "pending_payment",
        paymentAmount: pricing.amount / 100, // Convert to major currency unit
        paymentCurrency: pricing.currency,
        country: userCountry,
      });

      await tempAppointment.save();

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: pricing.currency.toLowerCase(),
              product_data: {
                name: "Medical Consultation",
                description: `Consultation with Dr. ${doctor.name} on ${date} at ${slot}`,
                images: doctor.photoUrl ? [doctor.photoUrl] : [],
              },
              unit_amount: pricing.amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.FRONTEND_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&appointment_id=${tempAppointment._id}`,
        cancel_url: `${process.env.FRONTEND_CANCEL_URL}?appointment_id=${tempAppointment._id}`,
        customer_email: patient.email,
        metadata: {
          appointmentId: tempAppointment._id.toString(),
          patientId: patientId,
          doctorId: doctorId,
          date: date,
          slot: slot,
          country: userCountry,
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // Expire in 30 minutes
      });

      // Create payment record
      const payment = new Payment({
        patientId,
        appointmentId: tempAppointment._id,
        doctorId,
        stripeSessionId: session.id,
        amount: pricing.amount / 100, // Store in major currency unit
        currency: pricing.currency,
        country: userCountry,
        appointmentDate: appointmentDateUTC,
        appointmentSlot: slot,
        status: "pending",
        stripeMetadata: session.metadata,
      });

      await payment.save();

      // Link payment to appointment
      tempAppointment.paymentId = payment._id;
      await tempAppointment.save();

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
          appointmentId: tempAppointment._id,
          amount: pricing.amount / 100,
          currency: pricing.currency,
          country: userCountry,
        },
      });
    } catch (error) {
      console.error("Error creating Stripe session:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create payment session",
        error: error.message,
      });
    }
  }
);

// POST /api/payments/webhook - Handle Stripe webhook events
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object);
          break;
        case "checkout.session.expired":
          await handleCheckoutSessionExpired(event.data.object);
          break;
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event.data.object);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error handling webhook:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);

// Helper function to handle successful checkout session
const handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log("Processing completed checkout session:", session.id);

    // Find the payment record
    const payment = await Payment.findOne({ stripeSessionId: session.id });
    if (!payment) {
      console.error("Payment not found for session:", session.id);
      return;
    }

    // Find the appointment
    const appointment = await Appointment.findById(payment.appointmentId);
    if (!appointment) {
      console.error("Appointment not found for payment:", payment._id);
      return;
    }

    // Update payment status
    payment.status = "completed";
    payment.stripePaymentIntentId = session.payment_intent;
    payment.stripeCustomerId = session.customer;
    await payment.save();

    // Update appointment status
    appointment.status = "upcoming";
    appointment.paymentStatus = "completed";
    appointment.confirmedAt = new Date();

    // Create Daily.co room for consultation
    try {
      const roomData = await dailyService.createRoom(appointment);
      appointment.meetingRoomName = roomData.roomName;
      appointment.meetingUrl = roomData.url;
    } catch (dailyError) {
      console.error("Failed to create Daily.co room:", dailyError);
      // Continue without meeting room - can be created later if needed
    }

    await appointment.save();

    console.log(
      "Successfully processed payment completion for appointment:",
      appointment._id
    );

    // TODO: Send confirmation email to patient and doctor
    // TODO: Send SMS/push notification if configured
  } catch (error) {
    console.error("Error handling checkout session completed:", error);
    throw error;
  }
};

// Helper function to handle expired checkout session
const handleCheckoutSessionExpired = async (session) => {
  try {
    console.log("Processing expired checkout session:", session.id);

    // Find the payment record
    const payment = await Payment.findOne({ stripeSessionId: session.id });
    if (!payment) {
      console.error("Payment not found for expired session:", session.id);
      return;
    }

    // Update payment status
    payment.status = "cancelled";
    await payment.save();

    // Cancel the appointment
    const appointment = await Appointment.findById(payment.appointmentId);
    if (appointment) {
      appointment.status = "cancelled";
      appointment.paymentStatus = "cancelled";
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = "system";
      appointment.cancelReason = "Payment session expired";
      await appointment.save();
    }

    console.log(
      "Successfully processed payment expiration for appointment:",
      appointment._id
    );
  } catch (error) {
    console.error("Error handling checkout session expired:", error);
    throw error;
  }
};

// Helper function to handle successful payment intent
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    console.log("Processing successful payment intent:", paymentIntent.id);

    // Find payment by payment intent ID
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });
    if (payment && payment.status !== "completed") {
      payment.status = "completed";
      await payment.save();
      console.log("Updated payment status to completed:", payment._id);
    }
  } catch (error) {
    console.error("Error handling payment intent succeeded:", error);
    throw error;
  }
};

// Helper function to handle failed payment
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    console.log("Processing failed payment intent:", paymentIntent.id);

    // Find payment by payment intent ID
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });
    if (payment) {
      payment.status = "failed";
      payment.errorMessage =
        paymentIntent.last_payment_error?.message || "Payment failed";
      payment.errorCode =
        paymentIntent.last_payment_error?.code || "payment_failed";
      await payment.save();

      // Cancel the appointment
      const appointment = await Appointment.findById(payment.appointmentId);
      if (appointment) {
        appointment.status = "cancelled";
        appointment.paymentStatus = "failed";
        appointment.cancelledAt = new Date();
        appointment.cancelledBy = "system";
        appointment.cancelReason = "Payment failed";
        await appointment.save();
      }

      console.log(
        "Successfully processed payment failure for appointment:",
        appointment._id
      );
    }
  } catch (error) {
    console.error("Error handling payment intent failed:", error);
    throw error;
  }
};

// GET /api/payments/:sessionId - Get payment session status
router.get(
  "/session/:sessionId",
  authenticateToken,
  [param("sessionId").notEmpty().withMessage("Session ID is required")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Find payment by session ID
      const payment = await Payment.findOne({ stripeSessionId: sessionId })
        .populate("appointmentId")
        .populate("doctorId", "name email specialties");

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment session not found",
        });
      }

      // Check if user owns this payment
      if (payment.patientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Get session from Stripe for latest status
      const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

      res.json({
        success: true,
        data: {
          payment: payment,
          stripeSession: {
            id: stripeSession.id,
            status: stripeSession.status,
            payment_status: stripeSession.payment_status,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching payment session:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment session",
        error: error.message,
      });
    }
  }
);

module.exports = router;
