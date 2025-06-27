const express = require("express");
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
} = require("../utils/appointmentUtils");

const router = express.Router();

// --- Helper Functions ---

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
    .isIn(["prescription", "consultation"])
    .withMessage("Plan must be either 'prescription' or 'consultation'"),
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

    // Add joinable status for consultation appointments
    const appointmentsWithJoinable = appointments.map((appointment) => {
      const appointmentObj = appointment.toObject();
      if (appointmentObj.plan === "consultation") {
        appointmentObj.isJoinable = isJoinable(appointmentObj);
        appointmentObj.minutesUntilJoinable =
          getMinutesUntilJoinable(appointmentObj);
        appointmentObj.hasPassed = hasAppointmentPassed(appointmentObj);
      }
      return appointmentObj;
    });

    const total = await Appointment.countDocuments(filter);

    res.json({
      success: true,
      data: appointmentsWithJoinable,
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

    // Add joinable status for consultation appointments
    const appointmentsWithJoinable = appointments.map((appointment) => {
      const appointmentObj = appointment.toObject();
      if (appointmentObj.plan === "consultation") {
        appointmentObj.isJoinable = isJoinable(appointmentObj);
        appointmentObj.minutesUntilJoinable =
          getMinutesUntilJoinable(appointmentObj);
        appointmentObj.hasPassed = hasAppointmentPassed(appointmentObj);
      }
      return appointmentObj;
    });

    const total = await Appointment.countDocuments(filter);

    res.json({
      success: true,
      data: appointmentsWithJoinable,
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

      // Check if slot is already booked
      const existingAppointment = await Appointment.findOne({
        doctorId,
        date: appointmentDateUTC,
        slot,
        status: { $in: ["pending", "confirmed"] },
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
  optionalDoctorAuth,
  [
    param("id").isMongoId().withMessage("Invalid appointment ID"),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Cancellation reason must not exceed 500 characters"),
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
      if (req.user) {
        const isDoctor = req.user.name; // Doctor model has name field
        const isPatient = !isDoctor;

        if (
          isDoctor &&
          appointment.doctorId.toString() !== req.user._id.toString()
        ) {
          return res.status(403).json({
            message: "Access denied",
          });
        }

        if (
          isPatient &&
          appointment.patientId.toString() !== req.user._id.toString()
        ) {
          return res.status(403).json({
            message: "Access denied",
          });
        }
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

      if (req.body.reason) {
        appointment.notes =
          (appointment.notes || "") + `\n[Cancelled] ${req.body.reason}`;
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

module.exports = router;
