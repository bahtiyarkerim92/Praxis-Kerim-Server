const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const {
  sendAppointmentConfirmation,
  sendAppointmentCancellation,
  sendFridayVideoNotification,
} = require("../services/mailer");
const { createOrUpdatePatient } = require("../services/patientService");
const crypto = require("crypto");

const router = express.Router();

const BERLIN_TZ = "Europe/Berlin";

const berlinWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: BERLIN_TZ,
});

const berlinDateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TZ,
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const berlinTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const berlinOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TZ,
  timeZoneName: "shortOffset",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const VIDEO_DOCTOR_NAMES = new Set(["M. Cem Samar"]);

function getBerlinOffsetMinutes(date) {
  const tzPart = berlinOffsetFormatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName");

  const match = tzPart?.value.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return 60; // Default offset (UTC+1)
  }

  const sign = match[1].startsWith("-") ? -1 : 1;
  const hours = Math.abs(Number(match[1]));
  const minutes = match[2] ? Number(match[2]) : 0;

  return sign * (hours * 60 + minutes);
}

function getAppointmentDateTimeUtcFromSlot(dateObj, slot) {
  if (!dateObj || !slot) {
    return null;
  }

  const [hour, minute] = slot.split(":").map(Number);
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth();
  const day = dateObj.getUTCDate();

  const baseUtcMillis = Date.UTC(year, month, day, hour, minute);
  const baseDate = new Date(baseUtcMillis);
  const offsetMinutes = getBerlinOffsetMinutes(baseDate);

  return new Date(baseUtcMillis - offsetMinutes * 60000);
}

function isBerlinFriday(dateUtc) {
  if (!dateUtc) {
    return false;
  }
  return berlinWeekdayFormatter.format(dateUtc) === "Fri";
}

function getBerlinFormattedDetails(dateUtc) {
  if (!dateUtc) {
    return {
      formattedDate: "",
      formattedTime: "",
    };
  }

  return {
    formattedDate: berlinDateFormatter.format(dateUtc),
    formattedTime: berlinTimeFormatter.format(dateUtc),
  };
}

function getAppointmentDateTimeUtcFromAppointment(appointment) {
  if (!appointment || !appointment.date) {
    return null;
  }

  const baseDate =
    appointment.date instanceof Date
      ? new Date(appointment.date)
      : new Date(appointment.date);

  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    return null;
  }

  if (appointment.slot) {
    return getAppointmentDateTimeUtcFromSlot(baseDate, appointment.slot);
  }

  return baseDate;
}

function computeIsVideoAppointment(appointment) {
  if (!appointment) {
    return false;
  }

  if (
    appointment.doctorId &&
    typeof appointment.doctorId === "object" &&
    appointment.doctorId !== null &&
    appointment.doctorId.name &&
    VIDEO_DOCTOR_NAMES.has(appointment.doctorId.name)
  ) {
    return true;
  }

  if (!appointment) {
    return false;
  }

  if (typeof appointment.isVideoAppointment === "boolean") {
    return appointment.isVideoAppointment;
  }

  const dateTimeUtc = getAppointmentDateTimeUtcFromAppointment(appointment);
  return isBerlinFriday(dateTimeUtc);
}

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

    const appointmentsDocs = await Appointment.find(filter)
      .populate("doctorId", "name")
      .sort({ date: 1, slot: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const appointments = appointmentsDocs.map((appointment) => {
      const appointmentObj = appointment.toObject({ virtuals: true });
      appointmentObj.isVideoAppointment = computeIsVideoAppointment(
        appointmentObj
      );
      return appointmentObj;
    });

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
      const appointmentDoc = await Appointment.findById(req.params.id).populate(
        "doctorId",
        "name"
      );

      if (!appointmentDoc) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      const appointment = appointmentDoc.toObject({ virtuals: true });
      appointment.isVideoAppointment = computeIsVideoAppointment(appointment);

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

    if (!patient.geburtsdatum || String(patient.geburtsdatum).trim() === "") {
      return res.status(400).json({
        error: "Invalid patient data: missing birthdate",
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

    // Extract time slot in HH:MM format (prefer original slot string if provided)
    let timeSlot = typeof slot.slot === "string" ? slot.slot : null;
    if (!timeSlot) {
      const hours = whenDate.getUTCHours().toString().padStart(2, "0");
      const minutes = whenDate.getUTCMinutes().toString().padStart(2, "0");
      timeSlot = `${hours}:${minutes}`;
    }

    const doctorNameTrimmed = (doctor.name || "").trim();
    const isVideoDoctor = VIDEO_DOCTOR_NAMES.has(doctorNameTrimmed);
    const isVideoAppointment = isVideoDoctor || isBerlinFriday(whenDate);

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
    const patientFullName = patient.name;

    // Generate unique management token
    const managementToken = crypto.randomBytes(32).toString("hex");

    const appointment = new Appointment({
      doctorId: slot.doctorId,
      date: appointmentDate,
      slot: timeSlot,
      patientEmail: patient.email,
      patientName: patientFullName,
      patientPhone: patient.telefon || "",
      title: patientFullName || "Termin",
      description: `Geburtsdatum: ${patient.geburtsdatum || "N/A"}, Adresse: ${patient.adresse || "N/A"}, Versicherungsnummer: ${patient.versicherungsnummer || "N/A"}, Versicherungsart: ${patient.versicherungsart || "N/A"}`,
      locale: locale || "de",
      managementToken: managementToken,
      status: "scheduled",
      isVideoAppointment,
    });

    await appointment.save();

    const populatedAppointment = await Appointment.findById(
      appointment._id
    ).populate("doctorId", "name");
    if (populatedAppointment) {
      populatedAppointment.isVideoAppointment = isVideoAppointment;
    }

    // Save patient record for marketing (only if email doesn't exist)
    try {
      await createOrUpdatePatient({
        name: patientFullName,
        email: patient.email,
        phone: patient.telefon || "",
      });
    } catch (patientError) {
      console.error("Error saving patient record:", patientError);
      // Don't fail appointment creation if patient save fails
    }

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
          managementToken: managementToken,
          isVideoAppointment,
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

    // Notify practice about video consultations
    try {
      if (isVideoAppointment) {
        const { formattedDate, formattedTime } =
          getBerlinFormattedDetails(whenDate);

        await sendFridayVideoNotification({
          doctorName: doctor.name,
          formattedDate,
          formattedTime,
          patientName: patientFullName,
          patientEmail: patient.email,
          patientPhone: patient.telefon || "",
          insuranceType: patient.versicherungsart || "",
          insuranceNumber: patient.versicherungsnummer || "",
          notes: patient.notes || "",
        });
        console.log(
          `📬 Video consultation notification sent for ${patient.email}`
        );
      }
    } catch (notifyError) {
      console.error(
        "Failed to send video consultation notification:",
        notifyError
      );
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
      const doctorNameTrimmed = (doctor.name || "").trim();
      const isVideoDoctor = VIDEO_DOCTOR_NAMES.has(doctorNameTrimmed);
      const isVideoAppointment =
        isVideoDoctor ||
        isBerlinFriday(
          getAppointmentDateTimeUtcFromSlot(appointmentDate, slot)
        );

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
        isVideoAppointment,
      });

      await appointment.save();

      const populatedAppointment = await Appointment.findById(
        appointment._id
      ).populate("doctorId", "name");
      if (populatedAppointment) {
        populatedAppointment.isVideoAppointment = appointment.isVideoAppointment;
      }

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
            isVideoAppointment: appointment.isVideoAppointment,
          },
          "de" // Default locale, can be passed from request if needed
        );
        console.log("Appointment confirmation email sent to:", patientEmail);
      } catch (emailError) {
        // Log email error but don't fail the appointment creation
        console.error("Failed to send confirmation email:", emailError);
      }

      // Notify practice if appointment qualifies as video consultation
      try {
        if (appointment.isVideoAppointment) {
          const appointmentDateTimeUtc = getAppointmentDateTimeUtcFromSlot(
            appointmentDate,
            slot
          );
          const { formattedDate, formattedTime } =
            getBerlinFormattedDetails(appointmentDateTimeUtc);

          await sendFridayVideoNotification({
            doctorName: doctor.name,
            formattedDate,
            formattedTime,
            patientName: patientName || "Patient",
            patientEmail,
            patientPhone: patientPhone || "",
            insuranceType: "",
            insuranceNumber: "",
            notes: notes || "",
          });
          console.log(
            `📬 Video consultation notification sent (manual create) for ${patientEmail}`
          );
        }
      } catch (notifyError) {
        console.error(
          "Failed to send video consultation notification (manual create):",
          notifyError
        );
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

      // Track if appointment is being cancelled to send email
      const isCancelling = status === "cancelled" && appointment.status !== "cancelled";

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

      // Send cancellation email if appointment was just cancelled
      if (isCancelling) {
        try {
          // Get patient email and locale
          const patientEmail = updatedAppointment.patientEmail;
          const locale = updatedAppointment.locale || "de";

          if (patientEmail) {
            // Prepare appointment data for email
            const isVideoAppointment =
              computeIsVideoAppointment(updatedAppointment);
            const appointmentData = {
              doctorName: updatedAppointment.doctorId?.name || "N/A",
              date: updatedAppointment.date,
              slot: updatedAppointment.slot,
              isVideoAppointment,
            };

            // Send cancellation email
            await sendAppointmentCancellation(patientEmail, appointmentData, locale);
            console.log(`✅ Cancellation email sent to ${patientEmail}`);
          } else {
            console.log("⚠️ No patient email found, skipping cancellation email");
          }
        } catch (emailError) {
          console.error("❌ Error sending cancellation email:", emailError);
          // Don't fail the request if email fails
        }
      }

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

// PUT /api/appointments/:id/cancel - Cancel appointment with optional reason (ADMIN)
router.put(
  "/:id/cancel",
  authenticateToken,
  param("id").isMongoId().withMessage("Valid appointment ID is required"),
  body("reason").optional().trim().isLength({ max: 500 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { reason } = req.body;

      const appointment = await Appointment.findById(req.params.id).populate(
        "doctorId",
        "name"
      );

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status === "cancelled") {
        return res.status(400).json({
          message: "Appointment is already cancelled",
        });
      }

      if (appointment.status === "completed") {
        return res.status(400).json({
          message: "Completed appointments cannot be cancelled",
        });
      }

      appointment.status = "cancelled";
      appointment.cancelledAt = new Date();
      if (reason) {
        appointment.cancelReason = reason;
      }

      await appointment.save();

      const locale = appointment.locale || "de";
      const patientEmail = appointment.patientEmail;

      if (patientEmail) {
        try {
          await sendAppointmentCancellation(
            patientEmail,
            {
              doctorName: appointment.doctorId?.name || "N/A",
              date: appointment.date,
              slot: appointment.slot,
            },
            locale
          );
          console.log(`✅ Cancellation email sent to ${patientEmail}`);
        } catch (emailError) {
          console.error("❌ Error sending cancellation email:", emailError);
        }
      } else {
        console.log("⚠️ No patient email found, skipping cancellation email");
      }

      return res.status(200).json({
        success: true,
        message: "Appointment cancelled successfully",
        appointment: {
          _id: appointment._id,
          status: appointment.status,
          cancelledAt: appointment.cancelledAt,
          cancelReason: appointment.cancelReason,
        },
      });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      return res.status(500).json({
        message: "Error cancelling appointment",
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
