const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const { sendAppointmentConfirmation } = require("../services/mailer");

const router = express.Router();

// Helper function
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

// Validation rules
const appointmentValidationRules = [
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
  body("patientEmail")
    .isEmail()
    .withMessage("Valid email address is required")
    .normalizeEmail(),
  body("patientName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Patient name must be between 2 and 100 characters"),
  body("patientPhone")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone number must not exceed 20 characters"),
  body("title")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Title must not exceed 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes must not exceed 1000 characters"),
];

// GET /api/appointments - Get all appointments (PUBLIC for dashboard access)
router.get("/", async (req, res) => {
  try {
    const {
      status,
      doctorId,
      date,
      startDate,
      endDate,
      limit = 50,
      page = 1,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (doctorId) {
      filter.doctorId = doctorId;
    }

    if (date) {
      const targetDateUTC = new Date(date + "T00:00:00.000Z");
      const nextDayUTC = new Date(targetDateUTC);
      nextDayUTC.setUTCDate(nextDayUTC.getUTCDate() + 1);

      filter.date = {
        $gte: targetDateUTC,
        $lt: nextDayUTC,
      };
    }

    if (startDate && endDate) {
      const start = new Date(startDate + "T00:00:00.000Z");
      const end = new Date(endDate + "T23:59:59.999Z");

      filter.date = {
        $gte: start,
        $lte: end,
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name")
      .sort({ date: 1, slot: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(filter);

    return res.status(200).json({
      success: true,
      appointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return res.status(500).json({
      message: "Error fetching appointments",
      error: error.message,
    });
  }
});

// GET /api/appointments/:id - Get specific appointment (PUBLIC for dashboard access)
router.get(
  "/:id",
  param("id").isMongoId().withMessage("Valid appointment ID is required"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id).populate(
        "doctorId",
        "name"
      );

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      return res.status(200).json({
        success: true,
        appointment,
      });
    } catch (error) {
      console.error("Error fetching appointment:", error);
      return res.status(500).json({
        message: "Error fetching appointment",
        error: error.message,
      });
    }
  }
);

// POST /api/appointments/book - Book appointment from website (PUBLIC)
router.post("/book", async (req, res) => {
  try {
    const { slot, patient, locale } = req.body;

    console.log("patient", patient);

    // Validate required fields
    if (!slot || !patient) {
      return res.status(400).json({
        error: "Missing required fields: slot and patient data",
      });
    }

    if (!slot.doctorId || !slot.when) {
      return res.status(400).json({
        error: "Invalid slot data: missing doctorId or when",
      });
    }

    if (!patient.email || !patient.name) {
      return res.status(400).json({
        error: "Invalid patient data: missing email or name",
      });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(slot.doctorId);
    if (!doctor) {
      return res.status(404).json({
        error: "Doctor not found",
      });
    }

    // Parse the "when" field (e.g., "2025-10-30T10:30:00.000Z")
    const whenDate = new Date(slot.when);
    const appointmentDate = new Date(whenDate);
    appointmentDate.setUTCHours(0, 0, 0, 0);

    // Extract time slot in HH:MM format
    const hours = whenDate.getUTCHours().toString().padStart(2, "0");
    const minutes = whenDate.getUTCMinutes().toString().padStart(2, "0");
    const timeSlot = `${hours}:${minutes}`;

    // Check if slot is available
    const existingAppointment = await Appointment.findOne({
      doctorId: slot.doctorId,
      date: appointmentDate,
      slot: timeSlot,
      status: { $in: ["scheduled"] },
    });

    if (existingAppointment) {
      return res.status(409).json({
        error: "Time slot is already booked",
      });
    }

    // Create appointment
    console.log("patient.name", patient.name);
    const patientFullName = patient.name;

    const appointment = new Appointment({
      doctorId: slot.doctorId,
      date: appointmentDate,
      slot: timeSlot,
      patientEmail: patient.email,
      patientName: patientFullName || patient.name,
      patientPhone: patient.telefon || "",
      title: patientFullName || patient.name || "Termin",
      description: `Geburtsdatum: ${patient.geburtsdatum || "N/A"}, Adresse: ${patient.adresse || "N/A"}, Versicherungsnummer: ${patient.versicherungsnummer || "N/A"}, Versicherungsart: ${patient.versicherungsart || "N/A"}`,
      status: "scheduled",
    });

    await appointment.save();

    const populatedAppointment = await Appointment.findById(
      appointment._id
    ).populate("doctorId", "name");

    // Send confirmation email
    try {
      const emailLocale = locale || "de"; // Default to German if no locale provided

      await sendAppointmentConfirmation(
        patient.email,
        {
          patientName: patientFullName,
          doctorName: doctor.name,
          date: appointmentDate,
          slot: timeSlot,
          title: patientFullName || "Termin",
          description: "",
        },
        emailLocale
      );
      console.log(
        `Appointment confirmation email sent to: ${patient.email} (locale: ${emailLocale})`
      );
    } catch (emailError) {
      // Log email error but don't fail the appointment creation
      console.error("Failed to send confirmation email:", emailError);
    }

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: populatedAppointment,
    });
  } catch (error) {
    console.error("Error booking appointment:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: "Time slot is already booked",
      });
    }

    return res.status(500).json({
      error: "Error booking appointment",
      message: error.message,
    });
  }
});

// POST /api/appointments - Create appointment (PUBLIC - no auth required for patient bookings)
router.post(
  "/",
  appointmentValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        doctorId,
        date,
        slot,
        patientEmail,
        patientName,
        patientPhone,
        title,
        description,
        notes,
      } = req.body;
      console.log(req.body);
      // Check if doctor exists
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      // Check if slot is available
      const appointmentDate = new Date(date + "T00:00:00.000Z");

      const existingAppointment = await Appointment.findOne({
        doctorId,
        date: appointmentDate,
        slot,
        status: { $in: ["scheduled"] },
      });

      if (existingAppointment) {
        return res.status(409).json({
          message: "Time slot is already booked",
        });
      }

      // Create appointment
      const appointment = new Appointment({
        doctorId,
        date: appointmentDate,
        slot,
        patientEmail,
        patientName,
        patientPhone,
        title,
        description,
        notes,
        status: "scheduled",
      });

      await appointment.save();

      const populatedAppointment = await Appointment.findById(
        appointment._id
      ).populate("doctorId", "name");

      // Send confirmation email
      try {
        const patientFullName = `${patientFirstName} ${patientLastName}`.trim();

        await sendAppointmentConfirmation(
          patientEmail,
          {
            patientName: patientFullName,
            doctorName: doctor.name,
            date: appointmentDate,
            slot: slot,
            title: patientFullName || title,
            description: description,
          },
          "de" // Default locale, can be passed from request if needed
        );
        console.log("Appointment confirmation email sent to:", patientEmail);
      } catch (emailError) {
        // Log email error but don't fail the appointment creation
        console.error("Failed to send confirmation email:", emailError);
      }

      return res.status(201).json({
        success: true,
        message: "Appointment created successfully",
        appointment: populatedAppointment,
      });
    } catch (error) {
      console.error("Error creating appointment:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "Time slot is already booked",
        });
      }

      return res.status(500).json({
        message: "Error creating appointment",
        error: error.message,
      });
    }
  }
);

// PATCH /api/appointments/:id - Update appointment
router.patch(
  "/:id",
  authenticateToken,
  param("id").isMongoId().withMessage("Valid appointment ID is required"),
  body("status")
    .optional()
    .isIn(["scheduled", "cancelled", "completed"])
    .withMessage("Invalid status"),
  body("title").optional().trim().isLength({ max: 200 }),
  body("description").optional().trim().isLength({ max: 1000 }),
  body("notes").optional().trim().isLength({ max: 1000 }),
  body("cancelReason").optional().trim().isLength({ max: 500 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      const { status, title, description, notes, cancelReason } = req.body;

      if (status) {
        appointment.status = status;
        if (status === "cancelled") {
          appointment.cancelledAt = new Date();
          if (cancelReason) {
            appointment.cancelReason = cancelReason;
          }
        } else if (status === "completed") {
          appointment.completedAt = new Date();
        }
      }

      if (title !== undefined) {
        appointment.title = title;
      }

      if (description !== undefined) {
        appointment.description = description;
      }

      if (notes !== undefined) {
        appointment.notes = notes;
      }

      await appointment.save();

      const updatedAppointment = await Appointment.findById(
        appointment._id
      ).populate("doctorId", "name");

      return res.status(200).json({
        success: true,
        message: "Appointment updated successfully",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error("Error updating appointment:", error);
      return res.status(500).json({
        message: "Error updating appointment",
        error: error.message,
      });
    }
  }
);

// DELETE /api/appointments/:id - Delete appointment
router.delete(
  "/:id",
  authenticateToken,
  param("id").isMongoId().withMessage("Valid appointment ID is required"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const appointment = await Appointment.findByIdAndDelete(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Appointment deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      return res.status(500).json({
        message: "Error deleting appointment",
        error: error.message,
      });
    }
  }
);

module.exports = router;
