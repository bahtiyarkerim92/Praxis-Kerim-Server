const express = require("express");
const { body, param, validationResult } = require("express-validator");
const mongoose = require("mongoose");
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

// Helper function to get frontend origin from request
const getFrontendOrigin = (req) => {
  // First priority: environment variables (for production)
  if (process.env.FRONTEND_SUCCESS_URL) {
    const url = new URL(process.env.FRONTEND_SUCCESS_URL);
    return url.origin;
  }

  // Second priority: origin header from the request
  const origin = req.headers.origin;
  if (origin) {
    return origin;
  }

  // Third priority: referer header
  const referer = req.headers.referer;
  if (referer) {
    const url = new URL(referer);
    return url.origin;
  }

  // Fourth priority: x-forwarded-host with protocol detection
  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host;
  if (forwardedHost) {
    const protocol =
      req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
    return `${protocol}://${forwardedHost}`;
  }

  // Fallback to common development ports (try 5173 first, then 5174)
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return "http://localhost:5173"; // Default to 5173 for Vite
  }

  // Final fallback for production
  return "https://telemediker.com";
};

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

// POST /api/payments/create-session - Create Stripe checkout session WITHOUT creating appointment
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

      console.log("🔄 Creating payment session for booking:", {
        doctorId,
        date,
        slot,
        patientId,
        reason: reason || "General consultation",
      });

      // Verify patient exists
      const patient = await User.findById(patientId);
      if (!patient) {
        console.log("❌ Patient not found:", patientId);
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      // Verify doctor exists and is active
      const doctor = await Doctor.findById(doctorId);
      if (!doctor || !doctor.isActive) {
        console.log("❌ Doctor not found or inactive:", doctorId);
        return res.status(404).json({
          success: false,
          message: "Doctor not found or inactive",
        });
      }

      // Parse appointment date as UTC
      const appointmentDateUTC = new Date(date + "T00:00:00.000Z");

      // LIGHT CHECK: Only check for confirmed appointments, not pending ones
      // Pending payments will be handled in the webhook with proper conflict resolution
      console.log("🔍 Checking for confirmed appointments...");
      const confirmedAppointment = await Appointment.findOne({
        doctorId,
        date: appointmentDateUTC,
        slot,
        status: { $in: ["upcoming", "completed"] }, // Only check truly confirmed appointments
      });

      if (confirmedAppointment) {
        console.log("❌ Slot already has confirmed appointment:", {
          appointmentId: confirmedAppointment._id,
          status: confirmedAppointment.status,
        });
        return res.status(409).json({
          success: false,
          message: "Time slot is no longer available",
          details: {
            conflictingStatus: confirmedAppointment.status,
            conflictingId: confirmedAppointment._id,
          },
        });
      }

      // Determine country and pricing
      const userCountry = requestCountry || detectUserCountry(patient, req);
      const pricing = getPricingForCountry(userCountry);

      console.log("💰 Pricing determined:", {
        country: userCountry,
        amount: pricing.amount,
        currency: pricing.currency,
      });

      // Create Stripe checkout session with ALL booking data in metadata
      // NO APPOINTMENT IS CREATED YET - everything happens in the webhook
      console.log("🏗️ Creating Stripe session...");

      // Determine frontend origin for redirect URLs
      const frontendOrigin = getFrontendOrigin(req);
      console.log(`🔗 Frontend origin detected: ${frontendOrigin}`);

      const successUrl = `${frontendOrigin}/booking/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendOrigin}/booking/cancel`;
      console.log(
        `📍 Stripe redirect URLs - Success: ${successUrl}, Cancel: ${cancelUrl}`
      );

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
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: patient.email,
        metadata: {
          // Store ALL booking details in Stripe metadata for webhook processing
          patientId: patientId,
          doctorId: doctorId,
          doctorName: doctor.name,
          patientEmail: patient.email,
          patientName:
            `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
          date: date,
          slot: slot,
          reason: reason || "General consultation",
          notes: notes || "",
          country: userCountry,
          currency: pricing.currency,
          amount: (pricing.amount / 100).toString(), // Store as string for metadata
          plan: "consultation",
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // Expire in 30 minutes
      });

      console.log("✅ Stripe session created successfully:", {
        sessionId: session.id,
        expiresAt: new Date(session.expires_at * 1000).toISOString(),
      });

      // Create payment record to track the session (but no appointment yet)
      const payment = new Payment({
        patientId,
        appointmentId: null, // Will be set after appointment is created in webhook
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
      console.log("✅ Payment record created:", payment._id);

      // In development, webhooks don't work, so provide manual processing endpoint
      const isDev = process.env.NODE_ENV === "development";
      if (isDev) {
        console.log(
          "🔧 Development mode: Use /api/payments/process-dev-payment endpoint after successful payment"
        );
      }

      // Return session details for frontend redirect
      res.json({
        success: true,
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
          amount: pricing.amount / 100,
          currency: pricing.currency,
          country: userCountry,
          expiresAt: new Date(session.expires_at * 1000).toISOString(),
        },
      });
    } catch (error) {
      console.error("❌ Error creating Stripe session:", error);

      // Return appropriate error based on the type
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Invalid booking data",
          error: error.message,
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Booking conflict occurred",
          error: "Time slot may no longer be available",
        });
      }

      // Generic server error
      res.status(500).json({
        success: false,
        message: "Failed to create payment session",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
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

// Helper function to handle successful checkout session - CREATES APPOINTMENT AFTER PAYMENT
const handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log("🎉 Processing completed checkout session:", session.id);

    // Find the payment record
    const payment = await Payment.findOne({ stripeSessionId: session.id });
    if (!payment) {
      console.error("❌ Payment not found for session:", session.id);
      return;
    }

    // Extract booking details from Stripe metadata
    const metadata = session.metadata;
    const appointmentData = {
      patientId: metadata.patientId,
      doctorId: metadata.doctorId,
      date: new Date(metadata.date + "T00:00:00.000Z"),
      slot: metadata.slot,
      plan: metadata.plan || "consultation",
      reason: metadata.reason || "General consultation",
      notes: metadata.notes || "",
      paymentAmount: parseFloat(metadata.amount),
      paymentCurrency: metadata.currency,
      country: metadata.country,
    };

    console.log("📋 Creating appointment with data:", appointmentData);
    console.log("🗓️ Parsed date:", appointmentData.date);
    console.log("🕐 Slot:", appointmentData.slot);

    // Check for slot conflicts one more time before creating appointment
    console.log("🔍 Final slot availability check...");
    const existingAppointment = await Appointment.findOne({
      doctorId: appointmentData.doctorId,
      date: appointmentData.date,
      slot: appointmentData.slot,
      status: { $in: ["upcoming", "completed"] },
    });

    if (existingAppointment) {
      console.error("🚨 SLOT CONFLICT detected during webhook processing:", {
        existingId: existingAppointment._id,
        existingStatus: existingAppointment.status,
        sessionId: session.id,
      });

      // Issue automatic refund since slot is no longer available
      try {
        console.log("💸 Issuing automatic refund for session:", session.id);

        const refund = await stripe.refunds.create({
          payment_intent: session.payment_intent,
          reason: "duplicate",
          metadata: {
            reason: "Slot no longer available",
            originalSessionId: session.id,
            conflictingAppointmentId: existingAppointment._id.toString(),
          },
        });

        console.log("✅ Refund issued successfully:", refund.id);

        // Update payment status to refunded
        payment.status = "refunded";
        payment.errorMessage = "Slot conflict - automatic refund issued";
        payment.errorCode = "slot_conflict";
        await payment.save();

        // TODO: Send email notification to patient about refund and slot conflict
        console.log("📧 TODO: Send refund notification email to patient");

        return;
      } catch (refundError) {
        console.error("❌ Failed to issue refund:", refundError);

        // Update payment status to failed if refund fails
        payment.status = "failed";
        payment.errorMessage = "Slot conflict occurred but refund failed";
        payment.errorCode = "refund_failed";
        await payment.save();

        throw refundError;
      }
    }

    // No conflict - proceed to create appointment
    try {
      console.log("✨ Creating new appointment...");
      console.log("👤 Patient ID:", appointmentData.patientId);
      console.log("👨‍⚕️ Doctor ID:", appointmentData.doctorId);

      const appointment = new Appointment({
        ...appointmentData,
        status: "upcoming", // Directly set to upcoming since payment is confirmed
        paymentStatus: "completed",
        confirmedAt: new Date(),
        paymentId: payment._id,
      });

      console.log("💾 About to save appointment:", {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        date: appointment.date,
        slot: appointment.slot,
        status: appointment.status,
      });

      await appointment.save();
      console.log("✅ Appointment created successfully:", appointment._id);

      // Update payment record with appointment ID
      payment.appointmentId = appointment._id;
      payment.status = "completed";
      payment.stripePaymentIntentId = session.payment_intent;
      payment.stripeCustomerId = session.customer;
      await payment.save();

      // Create Daily.co room for consultation
      try {
        const roomData = await dailyService.createRoom(appointment);
        appointment.meetingRoomName = roomData.roomName;
        appointment.meetingUrl = roomData.url;
        await appointment.save();
        console.log("🎥 Daily.co room created:", roomData.roomName);
      } catch (dailyError) {
        console.error("⚠️ Failed to create Daily.co room:", dailyError);
        // Continue without meeting room - can be created later if needed
      }

      console.log(
        "🎊 Successfully processed payment and created appointment:",
        appointment._id
      );

      // TODO: Send confirmation email to patient and doctor
      // TODO: Send SMS/push notification if configured
    } catch (appointmentError) {
      console.error("❌ Failed to create appointment:", appointmentError);
      console.error("📋 Appointment data that failed:", appointmentData);

      // Log specific error details
      if (appointmentError.name === "ValidationError") {
        console.error("🔍 Validation errors:", appointmentError.errors);
      }
      if (appointmentError.code === 11000) {
        console.error(
          "🚫 Duplicate key error - appointment already exists:",
          appointmentError.keyValue
        );
      }

      // If appointment creation fails due to duplicate key, issue refund
      if (appointmentError.code === 11000) {
        console.log("💸 Issuing refund due to duplicate key error");

        try {
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent,
            reason: "duplicate",
            metadata: {
              reason: "Database constraint violation",
              originalSessionId: session.id,
              error: "E11000 duplicate key error",
            },
          });

          payment.status = "refunded";
          payment.errorMessage = "Appointment creation failed - duplicate key";
          payment.errorCode = "duplicate_key";
          await payment.save();

          console.log("✅ Refund issued for duplicate key error:", refund.id);
        } catch (refundError) {
          console.error(
            "❌ Failed to issue refund for duplicate key:",
            refundError
          );
          payment.status = "failed";
          payment.errorMessage =
            "Appointment creation failed and refund failed";
          payment.errorCode = "creation_and_refund_failed";
          await payment.save();
        }
      } else {
        // For other errors, mark payment as failed
        payment.status = "failed";
        payment.errorMessage = appointmentError.message;
        payment.errorCode = "appointment_creation_failed";
        await payment.save();
        console.error(
          "💳 Payment status updated to failed due to appointment creation error"
        );
      }

      throw appointmentError;
    }
  } catch (error) {
    console.error("❌ Error handling checkout session completed:", error);
    throw error;
  }
};

// Helper function to handle expired checkout session - NO APPOINTMENT TO CANCEL
const handleCheckoutSessionExpired = async (session) => {
  try {
    console.log("⏰ Processing expired checkout session:", session.id);

    // Find the payment record
    const payment = await Payment.findOne({ stripeSessionId: session.id });
    if (!payment) {
      console.error("❌ Payment not found for expired session:", session.id);
      return;
    }

    // Update payment status to cancelled (no appointment was created)
    payment.status = "cancelled";
    payment.errorMessage = "Payment session expired";
    payment.errorCode = "session_expired";
    await payment.save();

    console.log(
      "✅ Successfully marked expired payment session as cancelled:",
      payment._id
    );

    // Since no appointment was created, there's nothing else to clean up
    // The time slot remains available for other patients to book
  } catch (error) {
    console.error("❌ Error handling checkout session expired:", error);
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

// POST /api/payments/remove-conflict - Remove specific conflicting appointment (admin endpoint)
router.post("/remove-conflict", async (req, res) => {
  try {
    const { doctorId, date, slot } = req.body;

    if (!doctorId || !date || !slot) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: doctorId, date, slot",
      });
    }

    // Parse the date consistently
    const appointmentDate = new Date(date + "T00:00:00.000Z");

    // Find the conflicting appointment
    const conflictingAppointment = await Appointment.findOne({
      doctorId: doctorId,
      date: appointmentDate,
      slot: slot,
    })
      .populate("doctorId", "name")
      .populate("patientId", "firstName lastName email");

    if (conflictingAppointment) {
      console.log(`🔍 Found conflicting appointment:`, {
        id: conflictingAppointment._id,
        status: conflictingAppointment.status,
        doctor: conflictingAppointment.doctorId?.name,
        patient: conflictingAppointment.patientId
          ? `${conflictingAppointment.patientId.firstName} ${conflictingAppointment.patientId.lastName}`
          : "Unknown",
        createdAt: conflictingAppointment.createdAt,
      });

      // Cancel the appointment
      const result = await Appointment.updateOne(
        { _id: conflictingAppointment._id },
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: "admin",
          cancelReason: "Manual removal - slot conflict resolution",
        }
      );

      res.json({
        success: true,
        message: "Conflicting appointment cancelled successfully",
        data: {
          appointmentId: conflictingAppointment._id,
          previousStatus: conflictingAppointment.status,
          cancelled: result.modifiedCount > 0,
        },
      });
    } else {
      res.json({
        success: true,
        message: "No conflicting appointment found - slot should be available",
        data: {
          searchCriteria: {
            doctorId,
            date: appointmentDate.toISOString(),
            slot,
          },
        },
      });
    }
  } catch (error) {
    console.error("Error removing conflict:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove conflict",
      error: error.message,
    });
  }
});

// GET /api/payments/cleanup - Clean up expired pending payments (admin endpoint)
router.post("/cleanup", async (req, res) => {
  try {
    console.log("🧹 Starting comprehensive cleanup...");

    // 1. Drop problematic old indexes
    try {
      const db = mongoose.connection.db;
      await db.collection("payments").dropIndex("transactionId_1");
      console.log("✅ Dropped old transactionId_1 index");
    } catch (indexError) {
      console.log("ℹ️ transactionId_1 index not found (already cleaned)");
    }

    // 2. Clean up old pending payments
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oldPayments = await Payment.deleteMany({
      status: "pending",
      createdAt: { $lt: thirtyMinutesAgo },
    });
    console.log(
      `🗑️ Cleaned up ${oldPayments.deletedCount} old pending payments`
    );

    // 3. Clean up appointments older than 30 minutes with pending_payment status
    const expiredResult = await Appointment.updateMany(
      {
        status: "pending_payment",
        createdAt: { $lt: thirtyMinutesAgo },
      },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancelReason: "Payment session expired - cleanup",
      }
    );

    // 4. Clean up orphaned pending_payment appointments without paymentId
    const orphanResult = await Appointment.updateMany(
      {
        status: "pending_payment",
        $or: [{ paymentId: { $exists: false } }, { paymentId: null }],
      },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancelReason: "Orphaned pending payment - cleanup",
      }
    );

    console.log(
      `✅ Cancelled ${expiredResult.modifiedCount} expired appointments`
    );
    console.log(
      `✅ Cancelled ${orphanResult.modifiedCount} orphaned appointments`
    );

    res.json({
      success: true,
      message: "Cleanup completed",
      data: {
        oldPaymentsDeleted: oldPayments.deletedCount,
        expiredCancelled: expiredResult.modifiedCount,
        orphanedCancelled: orphanResult.modifiedCount,
        totalCancelled:
          expiredResult.modifiedCount + orphanResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Cleanup failed",
      error: error.message,
    });
  }
});

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

// POST /api/payments/drop-index - Force drop the problematic transactionId index
router.post("/drop-index", async (req, res) => {
  try {
    console.log("🔧 Force dropping transactionId index...");

    const db = mongoose.connection.db;
    const collection = db.collection("payments");

    // List current indexes
    console.log("📋 Current indexes:");
    const indexes = await collection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${JSON.stringify(index.key)} (name: ${index.name})`);
    });

    let droppedCount = 0;

    // Try to drop transactionId_1 index by name
    try {
      await collection.dropIndex("transactionId_1");
      console.log("✅ Dropped transactionId_1 index by name");
      droppedCount++;
    } catch (error) {
      console.log("ℹ️ transactionId_1 index by name not found");
    }

    // Try to drop by key pattern
    try {
      await collection.dropIndex({ transactionId: 1 });
      console.log("✅ Dropped transactionId index by key pattern");
      droppedCount++;
    } catch (error) {
      console.log("ℹ️ transactionId index by key pattern not found");
    }

    // Also try other possible variations
    const possibleNames = [
      "transactionId_1",
      "transactionId",
      "transactionid_1",
    ];
    for (const name of possibleNames) {
      try {
        await collection.dropIndex(name);
        console.log(`✅ Dropped index: ${name}`);
        droppedCount++;
      } catch (error) {
        // Ignore if not found
      }
    }

    // Clean up any records with transactionId: null
    const deleteResult = await collection.deleteMany({ transactionId: null });
    console.log(
      `🗑️ Deleted ${deleteResult.deletedCount} problematic payment records`
    );

    // Show final indexes
    console.log("📋 Final indexes:");
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index) => {
      console.log(`  - ${JSON.stringify(index.key)} (name: ${index.name})`);
    });

    res.json({
      success: true,
      message: "Index cleanup completed",
      data: {
        indexesDropped: droppedCount,
        recordsDeleted: deleteResult.deletedCount,
        finalIndexes: finalIndexes.map((idx) => ({
          key: idx.key,
          name: idx.name,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Index drop failed:", error);
    res.status(500).json({
      success: false,
      message: "Index drop failed",
      error: error.message,
    });
  }
});

// GET /api/payments/debug - Debug payment and appointment status
router.get("/debug", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get recent payments
    const payments = await Payment.find({ patientId: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("appointmentId");

    // Get recent appointments
    const appointments = await Appointment.find({ patientId: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("doctorId");

    res.json({
      success: true,
      data: {
        recentPayments: payments,
        recentAppointments: appointments,
      },
    });
  } catch (error) {
    console.error("❌ Error debugging payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to debug payments",
      error: error.message,
    });
  }
});

// POST /api/payments/process-dev-payment - Manual payment processing for development
router.post("/process-dev-payment", authenticateToken, async (req, res) => {
  try {
    console.log("🔧 Manual development payment processing triggered");

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Check if this is development mode
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available in development mode",
      });
    }

    // Get the session from Stripe to check its status
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed yet",
        paymentStatus: session.payment_status,
      });
    }

    // Find the payment record
    const payment = await Payment.findOne({ stripeSessionId: sessionId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // Check if appointment already exists
    if (payment.appointmentId) {
      const existingAppointment = await Appointment.findById(
        payment.appointmentId
      );
      if (existingAppointment) {
        return res.json({
          success: true,
          message: "Appointment already exists",
          data: {
            appointmentId: existingAppointment._id,
            status: existingAppointment.status,
          },
        });
      }
    }

    // Process the completed session (simulate webhook)
    console.log(
      "🔄 Calling handleCheckoutSessionCompleted for session:",
      sessionId
    );
    await handleCheckoutSessionCompleted(session);
    console.log("✅ handleCheckoutSessionCompleted completed");

    // Find the created appointment
    const updatedPayment = await Payment.findOne({
      stripeSessionId: sessionId,
    }).populate("appointmentId");

    console.log("💳 Updated payment after processing:", {
      id: updatedPayment._id,
      status: updatedPayment.status,
      appointmentId: updatedPayment.appointmentId,
      errorMessage: updatedPayment.errorMessage,
    });

    res.json({
      success: true,
      message: "Payment processed and appointment created",
      data: {
        paymentId: updatedPayment._id,
        appointmentId: updatedPayment.appointmentId?._id,
        status: updatedPayment.status,
      },
    });
  } catch (error) {
    console.error("❌ Error processing development payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message,
    });
  }
});

// POST /api/payments/process-webhook-manually - Manual webhook processing for production
router.post(
  "/process-webhook-manually",
  authenticateToken,
  async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }

      console.log("🔄 Manual webhook processing for session:", sessionId);

      // Find the payment record
      const payment = await Payment.findOne({ stripeSessionId: sessionId });
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      // Check if appointment already exists
      if (payment.appointmentId) {
        return res.json({
          success: true,
          message: "Appointment already exists",
          data: {
            paymentId: payment._id,
            appointmentId: payment.appointmentId,
            status: payment.status,
          },
        });
      }

      // Get the Stripe session to simulate webhook
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.status(400).json({
          success: false,
          message: "Payment not completed",
        });
      }

      // Process the webhook manually
      await handleCheckoutSessionCompleted(session);

      // Get updated payment
      const updatedPayment = await Payment.findOne({
        stripeSessionId: sessionId,
      }).populate("appointmentId");

      res.json({
        success: true,
        message: "Webhook processed successfully",
        data: {
          paymentId: updatedPayment._id,
          appointmentId: updatedPayment.appointmentId?._id,
          status: updatedPayment.status,
        },
      });
    } catch (error) {
      console.error("❌ Error in manual webhook processing:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process webhook",
        error: error.message,
      });
    }
  }
);

// GET /api/payments/history - Get user's payment history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all payments for this user with completed status
    const payments = await Payment.find({
      patientId: userId,
      status: { $in: ["completed", "refunded"] },
    })
      .populate("appointmentId", "date slot reason")
      .populate("doctorId", "name specialties")
      .sort({ createdAt: -1 }) // Most recent first
      .limit(50); // Limit to last 50 payments

    // For each payment, get receipt URL from Stripe if available
    const paymentHistory = await Promise.all(
      payments.map(async (payment) => {
        let receiptUrl = null;

        // Try to get receipt URL from Stripe if payment intent exists
        if (payment.stripePaymentIntentId) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              payment.stripePaymentIntentId
            );

            // Get the latest charge for this payment intent
            if (paymentIntent.latest_charge) {
              const charge = await stripe.charges.retrieve(
                paymentIntent.latest_charge
              );
              receiptUrl = charge.receipt_url;
            }
          } catch (stripeError) {
            console.warn(
              `Could not retrieve receipt for payment ${payment._id}:`,
              stripeError.message
            );
          }
        }

        return {
          id: payment._id,
          date: payment.completedAt || payment.createdAt,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          receiptUrl: receiptUrl,
          appointment: payment.appointmentId
            ? {
                date: payment.appointmentId.date,
                slot: payment.appointmentId.slot,
                reason: payment.appointmentId.reason,
              }
            : null,
          doctor: payment.doctorId
            ? {
                name: payment.doctorId.name,
                specialties: payment.doctorId.specialties,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      data: paymentHistory,
      total: paymentHistory.length,
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error.message,
    });
  }
});

module.exports = router;
