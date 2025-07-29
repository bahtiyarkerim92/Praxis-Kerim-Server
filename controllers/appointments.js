const express = require("express");
const jwt = require("jsonwebtoken");
const { body, param, query, validationResult } = require("express-validator");
const {
  authenticateDoctorToken,
  optionalDoctorAuth,
} = require("../middleware/doctorAuth");
const { authenticateToken } = require("../middleware/auth");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const Availability = require("../models/Availability");
const dailyService = require("../services/daily/dailyService");
const {
  isJoinable,
  getMinutesUntilJoinable,
  hasAppointmentPassed,
  shouldAutoComplete,
  autoCompleteAppointments,
  getAppointmentsDueForCompletion,
} = require("../utils/appointmentUtils");

const router = express.Router();

// --- Helper Functions ---

// Combined authentication middleware for both doctors and patients
const optionalCombinedAuth = async (req, res, next) => {
  try {
    console.log("🔐 Combined auth middleware called");
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    console.log("🔑 Auth header present:", !!authHeader);
    console.log("🎫 Access token present:", !!accessToken);

    if (accessToken) {
      try {
        // First try doctor authentication
        console.log("🩺 Trying doctor authentication...");
        const doctorPayload = jwt.verify(
          accessToken,
          process.env.DOCTOR_JWT_SECRET
        );

        if (doctorPayload && doctorPayload.userType === "doctor") {
          const doctor = await Doctor.findById(doctorPayload.userId);
          if (doctor && doctor.isActive) {
            console.log("✅ Doctor authentication successful:", doctor.email);
            req.doctor = doctor;
            req.user = doctor; // Set user as doctor for unified access
            req.isAuthenticated = true;
            req.userType = "doctor";
            return next();
          }
        }
      } catch (error) {
        console.log("❌ Doctor authentication failed:", error.message);
        // Not a doctor token, try patient authentication
      }

      try {
        // Try patient authentication
        console.log("👤 Trying patient authentication...");
        const patientPayload = jwt.verify(
          accessToken,
          process.env.ACCESS_TOKEN_SECRET
        );

        if (patientPayload) {
          const patient = await User.findById(patientPayload.userId);
          if (patient) {
            console.log("✅ Patient authentication successful:", patient.email);
            req.user = patient;
            req.isAuthenticated = true;
            req.userType = "patient";
            return next();
          } else {
            console.log("❌ Patient not found in database");
          }
        }
      } catch (error) {
        console.log("❌ Patient authentication failed:", error.message);
        // Not a valid patient token either
      }
    }

    // No valid authentication found
    console.log("❌ No valid authentication found");
    return res.status(401).json({
      message: "Authentication required",
    });
  } catch (error) {
    console.error("Combined auth error:", error);
    return res.status(500).json({
      message: "Authentication error",
    });
  }
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.doctor || !req.doctor.isAdmin) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }
  next();
};

// --- Validation Rules ---

const appointmentValidationRules = [
  body("patientId")
    .optional()
    .isMongoId()
    .withMessage("Valid patient ID is required"),
  body("doctorId").isMongoId().withMessage("Valid doctor ID is required"),
  body("date")
    .isISO8601()
    .withMessage("Valid date is required")
    .custom((value) => {
      // Parse the incoming date as UTC
      const appointmentDate = new Date(value + "T00:00:00.000Z");
      const todayUTC = new Date();
      // Set to start of day in UTC
      todayUTC.setUTCHours(0, 0, 0, 0);

      // Allow appointments from today onwards (inclusive)
      if (appointmentDate < todayUTC) {
        throw new Error("Date cannot be in the past");
      }
      return true;
    }),
  body("slot")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Slot must be in HH:MM format"),
  body("plan")
    .isIn(["consultation"])
    .withMessage("Plan must be 'consultation'"),
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
];

// --- Routes ---

// GET /api/appointments/doctor - Get appointments for doctors (MUST BE FIRST!)
router.get("/doctor", authenticateDoctorToken, async (req, res) => {
  try {
    const {
      status,
      patientId,
      date,
      startDate,
      endDate,
      limit = 50,
      page = 1,
    } = req.query;

    const filter = {
      doctorId: req.doctor._id, // Only show this doctor's appointments
    };

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Patient filter
    if (patientId) {
      filter.patientId = patientId;
    }

    // Date filters - ensure UTC handling
    if (date) {
      // Parse date as UTC to avoid timezone shifts
      const targetDateUTC = new Date(date + "T00:00:00.000Z");
      const nextDayUTC = new Date(targetDateUTC);
      nextDayUTC.setUTCDate(nextDayUTC.getUTCDate() + 1);

      filter.date = {
        $gte: targetDateUTC,
        $lt: nextDayUTC,
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate + "T00:00:00.000Z"),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name email specialties")
      .populate("patientId", "firstName lastName email")
      .sort({ date: 1, slot: 1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Add joinable status and auto-complete logic for consultation appointments
    const appointmentsWithJoinable = appointments.map(async (appointment) => {
      const appointmentObj = appointment.toObject();

      // Auto-complete if needed
      if (shouldAutoComplete(appointmentObj)) {
        appointment.status = "completed";
        appointment.completedAt = new Date();
        await appointment.save();
        appointmentObj.status = "completed";
        appointmentObj.completedAt = appointment.completedAt;
      }

      if (appointmentObj.plan === "consultation") {
        appointmentObj.isJoinable = isJoinable(appointmentObj);
        appointmentObj.minutesUntilJoinable =
          getMinutesUntilJoinable(appointmentObj);
        appointmentObj.hasPassed = hasAppointmentPassed(appointmentObj);
      }
      return appointmentObj;
    });

    const resolvedAppointments = await Promise.all(appointmentsWithJoinable);
    const total = await Appointment.countDocuments(filter);

    // Debug: Log all appointments being sent to doctor
    console.log(
      `📋 Sending ${resolvedAppointments.length} appointments to doctor:`,
      resolvedAppointments.map((apt) => ({
        id: apt._id,
        date: apt.date,
        slot: apt.slot,
        status: apt.status,
        isJoinable: apt.isJoinable,
        minutesUntilJoinable: apt.minutesUntilJoinable,
      }))
    );

    res.json({
      success: true,
      data: resolvedAppointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    res.status(500).json({
      message: "Error fetching appointments",
      error: error.message,
    });
  }
});

// GET /api/appointments/doctor/:id - Get single appointment for doctors
router.get(
  "/doctor/:id",
  authenticateDoctorToken,
  [param("id").isMongoId().withMessage("Invalid appointment ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id)
        .populate("doctorId", "name email specialties")
        .populate("patientId", "firstName lastName email");

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check if doctor owns this appointment
      if (appointment.doctorId._id.toString() !== req.doctor._id.toString()) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      // Add joinable status for consultation appointments
      const appointmentObj = appointment.toObject();
      if (appointmentObj.plan === "consultation") {
        appointmentObj.isJoinable = isJoinable(appointmentObj);
        appointmentObj.minutesUntilJoinable =
          getMinutesUntilJoinable(appointmentObj);
        appointmentObj.hasPassed = hasAppointmentPassed(appointmentObj);
      }

      res.json({
        success: true,
        data: appointmentObj,
      });
    } catch (error) {
      console.error("Error fetching doctor appointment:", error);
      res.status(500).json({
        message: "Error fetching appointment",
        error: error.message,
      });
    }
  }
);

// GET /api/appointments - Get appointments (for patients)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      status,
      doctorId,
      patientId,
      date,
      startDate,
      endDate,
      limit = 50,
      page = 1,
    } = req.query;

    const filter = {};

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Doctor filter
    if (doctorId) {
      filter.doctorId = doctorId;
    }

    // Patient filter - handle both doctor and patient authentication
    if (patientId) {
      filter.patientId = patientId;
    } else if (req.user) {
      // Debug: Log user details to see what's happening
      console.log("🔍 User authentication debug:");
      console.log("User ID:", req.user._id);
      console.log("User email:", req.user.email);

      // For regular users (patients), filter by patientId
      console.log("👤 Identified as PATIENT - filtering by patientId");
      filter.patientId = req.user._id;

      console.log("Final filter:", filter);
    }

    // Date filters - ensure UTC handling
    if (date) {
      // Parse date as UTC to avoid timezone shifts
      const targetDateUTC = new Date(date + "T00:00:00.000Z");
      const nextDayUTC = new Date(targetDateUTC);
      nextDayUTC.setUTCDate(nextDayUTC.getUTCDate() + 1);

      filter.date = {
        $gte: targetDateUTC,
        $lt: nextDayUTC,
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate + "T00:00:00.000Z"),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name email specialties")
      .populate("patientId", "firstName lastName email")
      .sort({ date: 1, slot: 1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Add joinable status and auto-complete logic for consultation appointments
    const appointmentsWithJoinable = appointments.map(async (appointment) => {
      const appointmentObj = appointment.toObject();

      // Auto-complete if needed
      if (shouldAutoComplete(appointmentObj)) {
        appointment.status = "completed";
        appointment.completedAt = new Date();
        await appointment.save();
        appointmentObj.status = "completed";
        appointmentObj.completedAt = appointment.completedAt;
      }

      if (appointmentObj.plan === "consultation") {
        appointmentObj.isJoinable = isJoinable(appointmentObj);
        appointmentObj.minutesUntilJoinable =
          getMinutesUntilJoinable(appointmentObj);
        appointmentObj.hasPassed = hasAppointmentPassed(appointmentObj);
      }
      return appointmentObj;
    });

    const resolvedAppointments = await Promise.all(appointmentsWithJoinable);
    const total = await Appointment.countDocuments(filter);

    res.json({
      success: true,
      data: resolvedAppointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      message: "Error fetching appointments",
      error: error.message,
    });
  }
});

// GET /api/appointments/:id - Get single appointment
router.get(
  "/:id",
  authenticateToken,
  [param("id").isMongoId().withMessage("Invalid appointment ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id)
        .populate("doctorId", "name email specialties")
        .populate("patientId", "firstName lastName email");

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check access permissions - patients can only see their own appointments
      if (req.user) {
        if (appointment.patientId._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            message: "Access denied",
          });
        }
      }

      // Add joinable status for consultation appointments
      const appointmentObj = appointment.toObject();
      if (appointmentObj.plan === "consultation") {
        appointmentObj.isJoinable = isJoinable(appointmentObj);
        appointmentObj.minutesUntilJoinable =
          getMinutesUntilJoinable(appointmentObj);
        appointmentObj.hasPassed = hasAppointmentPassed(appointmentObj);
      }

      res.json({
        success: true,
        data: appointmentObj,
      });
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({
        message: "Error fetching appointment",
        error: error.message,
      });
    }
  }
);

// POST /api/appointments - Create new appointment (patients only)
router.post(
  "/",
  authenticateToken,
  appointmentValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { patientId, doctorId, date, slot, plan, reason, notes } = req.body;

      // Use authenticated user as patient if no patientId provided
      const finalPatientId = patientId || req.user._id.toString();

      // Check if user can create appointment for this patient
      if (finalPatientId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "You can only create appointments for yourself",
        });
      }

      // Verify patient exists
      const patient = await User.findById(finalPatientId);
      if (!patient) {
        return res.status(404).json({
          message: "Patient not found",
        });
      }

      // Verify doctor exists and is active
      const doctor = await Doctor.findById(doctorId);
      if (!doctor || !doctor.isActive) {
        return res.status(404).json({
          message: "Doctor not found or inactive",
        });
      }

      // Parse appointment date as UTC
      const appointmentDateUTC = new Date(date + "T00:00:00.000Z");

      // Check if slot is available
      const availability = await Availability.findOne({
        doctorId: doctorId,
        date: appointmentDateUTC,
        isActive: true,
      });

      if (!availability || !availability.slots.includes(slot)) {
        return res.status(409).json({
          message: "Time slot is not available",
          availableSlots: availability ? availability.slots : [],
        });
      }

      // Check if slot is already booked (only upcoming appointments)
      const existingAppointment = await Appointment.findOne({
        doctorId,
        date: appointmentDateUTC,
        slot,
        status: "upcoming",
      });

      if (existingAppointment) {
        return res.status(409).json({
          message: "Time slot is already booked",
        });
      }

      const appointment = new Appointment({
        patientId: finalPatientId,
        doctorId,
        date: appointmentDateUTC,
        slot,
        plan,
        reason,
        notes,
        status: "upcoming", // All new appointments are upcoming
      });

      // Create Daily.co room for consultation appointments
      if (plan === "consultation") {
        try {
          const roomData = await dailyService.createRoom(appointment);
          appointment.meetingRoomName = roomData.roomName;
          appointment.meetingUrl = roomData.url;
        } catch (dailyError) {
          console.error("Failed to create Daily.co room:", dailyError);
          // Continue without meeting room - can be created later if needed
        }
      }

      await appointment.save();
      await appointment.populate("doctorId", "name email specialties");
      await appointment.populate("patientId", "firstName lastName email");

      res.status(201).json({
        success: true,
        message: "Appointment created successfully",
        data: appointment,
      });
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({
        message: "Error creating appointment",
        error: error.message,
      });
    }
  }
);

// PUT /api/appointments/:id/confirm - Confirm appointment (doctors only)
router.put(
  "/:id/confirm",
  authenticateDoctorToken,
  [param("id").isMongoId().withMessage("Invalid appointment ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check if doctor owns this appointment
      if (appointment.doctorId.toString() !== req.doctor._id.toString()) {
        return res.status(403).json({
          message: "You can only confirm your own appointments",
        });
      }

      if (appointment.status !== "pending") {
        return res.status(400).json({
          message: `Cannot confirm appointment with status: ${appointment.status}`,
        });
      }

      appointment.status = "confirmed";
      appointment.confirmedAt = new Date(); // UTC timestamp
      await appointment.save();

      await appointment.populate("doctorId", "name email specialties");
      await appointment.populate("patientId", "firstName lastName email");

      res.json({
        success: true,
        message: "Appointment confirmed successfully",
        data: appointment,
      });
    } catch (error) {
      console.error("Error confirming appointment:", error);
      res.status(500).json({
        message: "Error confirming appointment",
        error: error.message,
      });
    }
  }
);

// PUT /api/appointments/:id/complete - Complete appointment (doctors only)
router.put(
  "/:id/complete",
  authenticateDoctorToken,
  [
    param("id").isMongoId().withMessage("Invalid appointment ID"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must not exceed 1000 characters"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check if doctor owns this appointment
      if (appointment.doctorId.toString() !== req.doctor._id.toString()) {
        return res.status(403).json({
          message: "You can only complete your own appointments",
        });
      }

      if (appointment.status === "completed") {
        return res.status(400).json({
          message: "Appointment is already completed",
        });
      }

      if (appointment.status === "cancelled") {
        return res.status(400).json({
          message: "Cannot complete cancelled appointment",
        });
      }

      appointment.status = "completed";

      if (req.body.notes) {
        appointment.notes = req.body.notes;
      }

      await appointment.save();

      await appointment.populate("doctorId", "name email specialties");
      await appointment.populate("patientId", "firstName lastName email");

      res.json({
        success: true,
        message: "Appointment completed successfully",
        data: appointment,
      });
    } catch (error) {
      console.error("Error completing appointment:", error);
      res.status(500).json({
        message: "Error completing appointment",
        error: error.message,
      });
    }
  }
);

// PUT /api/appointments/:id/cancel - Cancel appointment
router.put(
  "/:id/cancel",
  optionalCombinedAuth,
  [
    param("id").isMongoId().withMessage("Invalid appointment ID"),
    body("reason")
      .notEmpty()
      .withMessage("Cancellation reason is required")
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage("Cancellation reason must be between 10 and 500 characters"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check permissions - both doctors and patients can cancel
      const userType = req.userType;

      if (userType === "doctor") {
        if (appointment.doctorId.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            message:
              "Access denied - doctor can only cancel their own appointments",
          });
        }
      } else if (userType === "patient") {
        if (appointment.patientId.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            message:
              "Access denied - patient can only cancel their own appointments",
          });
        }
      } else {
        return res.status(403).json({
          message: "Access denied - invalid user type",
        });
      }

      if (appointment.status === "cancelled") {
        return res.status(400).json({
          message: "Appointment is already cancelled",
        });
      }

      if (appointment.status === "completed") {
        return res.status(400).json({
          message: "Cannot cancel completed appointment",
        });
      }

      appointment.status = "cancelled";
      appointment.cancelledAt = new Date(); // UTC timestamp

      // Track who cancelled and the reason
      appointment.cancelledBy = userType;

      if (req.body.reason) {
        appointment.cancelReason = req.body.reason;
      }

      await appointment.save();
      await appointment.populate("doctorId", "name email specialties");
      await appointment.populate("patientId", "firstName lastName email");

      res.json({
        success: true,
        message: "Appointment cancelled successfully",
        data: appointment,
      });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      res.status(500).json({
        message: "Error cancelling appointment",
        error: error.message,
      });
    }
  }
);

// GET /api/appointments/test/timing - Test endpoint to check timing logic
router.get("/test/timing", async (req, res) => {
  try {
    const { appointmentId } = req.query;

    if (appointmentId) {
      // Test specific appointment timing
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      const appointmentObj = appointment.toObject();

      res.json({
        success: true,
        appointment: {
          id: appointmentObj._id,
          date: appointmentObj.date,
          slot: appointmentObj.slot,
          plan: appointmentObj.plan,
        },
        timing: {
          isJoinable: isJoinable(appointmentObj),
          minutesUntilJoinable: getMinutesUntilJoinable(appointmentObj),
          hasPassed: hasAppointmentPassed(appointmentObj),
        },
        debug: {
          currentTimeUTC: new Date().toISOString(),
          appointmentDateTime: `${appointmentObj.date.toISOString().split("T")[0]} ${appointmentObj.slot}`,
        },
      });
    } else {
      // Just show current time info
      res.json({
        success: true,
        currentTimeUTC: new Date().toISOString(),
        currentTimeFormatted: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  } catch (error) {
    console.error("Error in timing test:", error);
    res
      .status(500)
      .json({ message: "Error in timing test", error: error.message });
  }
});

// PATCH /api/appointments/:id - Update appointment status (doctors only)
router.patch(
  "/:id",
  authenticateDoctorToken,
  [
    param("id").isMongoId().withMessage("Invalid appointment ID"),
    body("status")
      .isIn(["pending", "confirmed", "cancelled", "completed"])
      .withMessage("Invalid status"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must not exceed 1000 characters"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, notes } = req.body;

      const appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check if doctor owns this appointment
      if (appointment.doctorId.toString() !== req.doctor._id.toString()) {
        return res.status(403).json({
          message: "You can only update your own appointments",
        });
      }

      appointment.status = status;

      if (notes) {
        appointment.notes = notes;
      }

      appointment.updatedAt = new Date(); // UTC timestamp
      await appointment.save();

      await appointment.populate("doctorId", "name email specialties");
      await appointment.populate("patientId", "firstName lastName email");

      res.json({
        success: true,
        message: `Appointment status updated to ${status}`,
        data: appointment,
      });
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({
        message: "Error updating appointment",
        error: error.message,
      });
    }
  }
);

// POST /api/appointments/auto-complete - Trigger auto-completion of appointments
router.post("/auto-complete", async (req, res) => {
  try {
    const result = await autoCompleteAppointments();

    res.json({
      success: result.success,
      message: result.message,
      completedCount: result.completedCount,
    });
  } catch (error) {
    console.error("Error in auto-complete endpoint:", error);
    res.status(500).json({
      message: "Error running auto-complete",
      error: error.message,
    });
  }
});

// GET /api/appointments/due-for-completion - Check appointments due for completion
router.get("/due-for-completion", async (req, res) => {
  try {
    const result = await getAppointmentsDueForCompletion();

    res.json({
      success: result.success,
      count: result.count,
      appointments: result.appointments,
    });
  } catch (error) {
    console.error("Error checking appointments due for completion:", error);
    res.status(500).json({
      message: "Error checking appointments",
      error: error.message,
    });
  }
});

// PUT /api/appointments/:id/reschedule - Reschedule appointment
router.put(
  "/:id/reschedule",
  optionalCombinedAuth,
  [
    param("id").isMongoId().withMessage("Invalid appointment ID"),
    body("newDate")
      .isISO8601()
      .toDate()
      .withMessage("Valid new date is required (YYYY-MM-DD)"),
    body("newSlot")
      .notEmpty()
      .withMessage("New time slot is required")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Valid time slot is required (HH:MM format)"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      // Check permissions - both doctors and patients can reschedule
      const userType = req.userType;

      if (userType === "doctor") {
        if (appointment.doctorId.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied - doctor can only reschedule their own appointments",
          });
        }
      } else if (userType === "patient") {
        if (appointment.patientId.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied - patient can only reschedule their own appointments",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied - invalid user type",
        });
      }

      // Check if appointment can be rescheduled
      if (appointment.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Cannot reschedule cancelled appointment",
        });
      }

      if (appointment.status === "completed") {
        return res.status(400).json({
          success: false,
          message: "Cannot reschedule completed appointment",
        });
      }

      const { newDate, newSlot } = req.body;

      console.log("🔄 Reschedule request received:", {
        appointmentId: req.params.id,
        newDate,
        newSlot,
        dateType: typeof newDate,
      });

      // Parse the new date to ensure it's in the correct format
      // Handle both ISO string and date-only string formats
      let newAppointmentDate;
      if (typeof newDate === "string" && newDate.includes("T")) {
        // Already an ISO string
        newAppointmentDate = new Date(newDate);
      } else if (newDate instanceof Date) {
        // Already a Date object from validation
        newAppointmentDate = newDate;
      } else {
        // Date-only string, append time
        newAppointmentDate = new Date(newDate + "T00:00:00.000Z");
      }

      console.log("📅 Parsed appointment date:", newAppointmentDate);

      // Validate the parsed date
      if (isNaN(newAppointmentDate.getTime())) {
        console.error("❌ Invalid date parsed:", newAppointmentDate);
        return res.status(400).json({
          success: false,
          message: "Invalid date format provided",
        });
      }

      // Check if the new date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (newAppointmentDate < today) {
        return res.status(400).json({
          success: false,
          message: "Cannot reschedule to a past date",
        });
      }

      // Check if the new slot conflicts with existing appointments
      console.log("🔍 Checking for conflicts with query:", {
        doctorId: appointment.doctorId,
        date: newAppointmentDate,
        slot: newSlot,
        status: { $in: ["upcoming", "pending_payment"] },
        excludingAppointmentId: appointment._id,
      });

      const conflictingAppointment = await Appointment.findOne({
        doctorId: appointment.doctorId,
        date: newAppointmentDate,
        slot: newSlot,
        status: { $in: ["upcoming", "pending_payment"] },
        _id: { $ne: appointment._id }, // Exclude current appointment
      });

      console.log("🔍 Conflict check result:", {
        found: !!conflictingAppointment,
        conflictingId: conflictingAppointment?._id,
        conflictingStatus: conflictingAppointment?.status,
      });

      // Debug: Show all appointments for this doctor/date/slot combination
      const allAppointmentsAtSlot = await Appointment.find({
        doctorId: appointment.doctorId,
        date: newAppointmentDate,
        slot: newSlot,
      }).select("_id status createdAt updatedAt");

      console.log(
        "🔍 All appointments at target slot:",
        allAppointmentsAtSlot.map((apt) => ({
          id: apt._id,
          status: apt.status,
          isCurrentAppointment:
            apt._id.toString() === appointment._id.toString(),
          createdAt: apt.createdAt,
          updatedAt: apt.updatedAt,
        }))
      );

      if (conflictingAppointment) {
        console.log("❌ Conflict found - slot already taken");
        return res.status(409).json({
          success: false,
          message: "The selected time slot is no longer available",
        });
      }

      console.log("✅ No conflicts found - proceeding with reschedule");

      // Store original date and slot for logging
      const originalDate = appointment.date;
      const originalSlot = appointment.slot;

      console.log("📋 Current appointment details:", {
        id: appointment._id,
        currentDate: originalDate,
        currentSlot: originalSlot,
        status: appointment.status,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
      });

      // Update the appointment
      console.log("🔧 Updating appointment with:", {
        newDate: newAppointmentDate,
        newDateISO: newAppointmentDate.toISOString(),
        newSlot: newSlot,
      });

      appointment.date = newAppointmentDate;
      appointment.slot = newSlot;
      appointment.updatedAt = new Date();

      // Add reschedule tracking
      if (!appointment.rescheduleHistory) {
        appointment.rescheduleHistory = [];
      }
      appointment.rescheduleHistory.push({
        from: {
          date: originalDate,
          slot: originalSlot,
        },
        to: {
          date: newAppointmentDate,
          slot: newSlot,
        },
        rescheduledBy: userType,
        rescheduledAt: new Date(),
      });

      try {
        await appointment.save();
        console.log("✅ Appointment saved successfully");
      } catch (saveError) {
        if (saveError.code === 11000) {
          console.log(
            "❌ Duplicate key error during save - slot was taken by another appointment"
          );

          // Double-check for conflicts again
          const lastMinuteConflict = await Appointment.findOne({
            doctorId: appointment.doctorId,
            date: newAppointmentDate,
            slot: newSlot,
            status: { $in: ["upcoming", "pending_payment"] },
            _id: { $ne: appointment._id },
          });

          if (lastMinuteConflict) {
            console.log("🔍 Found the conflicting appointment:", {
              id: lastMinuteConflict._id,
              status: lastMinuteConflict.status,
              createdAt: lastMinuteConflict.createdAt,
            });
          }

          return res.status(409).json({
            success: false,
            message:
              "The selected time slot was just taken by another appointment. Please choose a different time.",
          });
        }
        throw saveError; // Re-throw if it's not a duplicate key error
      }

      await appointment.populate("doctorId", "name email specialties");
      await appointment.populate("patientId", "firstName lastName email");

      console.log(
        `📅 Appointment ${appointment._id} rescheduled by ${userType}`
      );
      console.log(
        `   From: ${originalDate.toISOString().split("T")[0]} ${originalSlot}`
      );
      console.log(`   To: ${newDate} ${newSlot}`);

      res.json({
        success: true,
        message: "Appointment rescheduled successfully",
        data: appointment,
      });
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      res.status(500).json({
        success: false,
        message: "Error rescheduling appointment",
        error: error.message,
      });
    }
  }
);

module.exports = router;
