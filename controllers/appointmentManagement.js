const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const {
  sendAppointmentCancellation,
  sendFridayVideoNotification,
} = require("../services/mailer");

const BERLIN_TZ = "Europe/Berlin";

const berlinOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TZ,
  timeZoneName: "shortOffset",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
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

const berlinWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TZ,
  weekday: "short",
});

const VIDEO_DOCTOR_NAMES = new Set(["M. Cem Samar"]);

function getBerlinOffsetMinutes(date) {
  const tzPart = berlinOffsetFormatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName");

  const match = tzPart?.value.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return 60; // Default UTC+1
  }

  const sign = match[1].startsWith("-") ? -1 : 1;
  const hours = Math.abs(Number(match[1]));
  const minutes = match[2] ? Number(match[2]) : 0;

  return sign * (hours * 60 + minutes);
}

function convertBerlinDateStringSlotToUtc(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    return null;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const baseUtcMillis = Date.UTC(year, month - 1, day, hour, minute);
  const baseDate = new Date(baseUtcMillis);
  const offsetMinutes = getBerlinOffsetMinutes(baseDate);

  return new Date(baseUtcMillis - offsetMinutes * 60000);
}

function getAppointmentDateTimeUtcFromSlot(dateObj, slot) {
  if (!dateObj || !slot) {
    return null;
  }

  const baseDate =
    dateObj instanceof Date ? new Date(dateObj) : new Date(dateObj);

  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const [hour, minute] = slot.split(":").map(Number);
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const day = baseDate.getUTCDate();

  const baseUtcMillis = Date.UTC(year, month, day, hour, minute);
  const baseDateWithTime = new Date(baseUtcMillis);
  const offsetMinutes = getBerlinOffsetMinutes(baseDateWithTime);

  return new Date(baseUtcMillis - offsetMinutes * 60000);
}

function getAppointmentDateTimeUtc(appointment) {
  if (!appointment || !appointment.date) {
    return null;
  }

  const appointmentDate = new Date(appointment.date);

  const year = appointmentDate.getUTCFullYear();
  const month = String(appointmentDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(appointmentDate.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  if (!appointment.slot) {
    return new Date(appointment.date);
  }

  return convertBerlinDateStringSlotToUtc(dateStr, appointment.slot);
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

// GET /api/appointment-management/:token - Get appointment details by token (PUBLIC)
router.get(
  "/:token",
  param("token").isLength({ min: 32, max: 128 }).withMessage("Invalid token format"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { token } = req.params;

      const appointment = await Appointment.findOne({
        managementToken: token,
      }).populate("doctorId", "name");

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found or token is invalid",
        });
      }

      // Don't allow management of cancelled or completed appointments
      if (appointment.status === "completed") {
        return res.status(400).json({
          message: "This appointment has already been completed and cannot be modified",
        });
      }

      const doctorNameTrimmed =
        appointment.doctorId && appointment.doctorId.name
          ? appointment.doctorId.name.trim()
          : "";
      const isVideoDoctor = VIDEO_DOCTOR_NAMES.has(doctorNameTrimmed);
      const isVideoAppointment =
        typeof appointment.isVideoAppointment === "boolean"
          ? appointment.isVideoAppointment || isVideoDoctor
          : isVideoDoctor || isBerlinFriday(getAppointmentDateTimeUtc(appointment));

      // Return appointment details (exclude sensitive fields)
      return res.status(200).json({
        success: true,
        appointment: {
          _id: appointment._id,
          doctorId: appointment.doctorId,
          date: appointment.date,
          slot: appointment.slot,
          patientName: appointment.patientName,
          patientEmail: appointment.patientEmail,
          patientPhone: appointment.patientPhone,
          status: appointment.status,
          locale: appointment.locale,
          isVideoAppointment,
          createdAt: appointment.createdAt,
        },
      });
    } catch (error) {
      console.error("Error fetching appointment by token:", error);
      return res.status(500).json({
        message: "Error fetching appointment",
        error: error.message,
      });
    }
  }
);

// PATCH /api/appointment-management/:token/cancel - Cancel appointment (PUBLIC)
router.patch(
  "/:token/cancel",
  param("token").isLength({ min: 32, max: 128 }).withMessage("Invalid token format"),
  body("reason").optional().trim().isLength({ max: 500 }).withMessage("Reason too long"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { reason } = req.body;

      const appointment = await Appointment.findOne({
        managementToken: token,
      }).populate("doctorId", "name");

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found or token is invalid",
        });
      }

      // Check if appointment is already cancelled
      if (appointment.status === "cancelled") {
        return res.status(400).json({
          message: "This appointment is already cancelled",
        });
      }

      // Check if appointment is completed
      if (appointment.status === "completed") {
        return res.status(400).json({
          message: "Cannot cancel a completed appointment",
        });
      }

      // Check if appointment is in the past (Berlin timezone aware)
      const appointmentDateTime = getAppointmentDateTimeUtc(appointment);
      const now = new Date();

      if (appointmentDateTime && appointmentDateTime <= now) {
        return res.status(400).json({
          message: "Cannot cancel an appointment that has already passed",
        });
      }

      // Update appointment status
      appointment.status = "cancelled";
      appointment.cancelledAt = new Date();
      appointment.cancelReason = reason || "Cancelled by patient";
      appointment.cancelledBy = "patient";

      await appointment.save();

      const updatedAppointment = await Appointment.findById(
        appointment._id
      ).populate("doctorId", "name");
      const updatedDoctorName =
        updatedAppointment?.doctorId?.name?.trim() || "";
      const isVideoDoctorUpdated = VIDEO_DOCTOR_NAMES.has(updatedDoctorName);
      const isVideoAppointment =
        typeof updatedAppointment.isVideoAppointment === "boolean"
          ? updatedAppointment.isVideoAppointment || isVideoDoctorUpdated
          : isVideoDoctorUpdated ||
            isBerlinFriday(getAppointmentDateTimeUtc(updatedAppointment));

      // Send cancellation confirmation email to patient
      try {
        const { sendPatientCancellationConfirmation } = require("../services/mailer");
        const locale = updatedAppointment.locale || "de";

        if (updatedAppointment.patientEmail) {
          const appointmentData = {
            doctorName: updatedAppointment.doctorId?.name || "N/A",
            date: updatedAppointment.date,
            slot: updatedAppointment.slot,
            isVideoAppointment,
          };
          await sendPatientCancellationConfirmation(updatedAppointment.patientEmail, appointmentData, locale);
          console.log(`✅ Cancellation confirmation email sent to ${updatedAppointment.patientEmail}`);
        } else {
          console.log("⚠️ No patient email found, skipping cancellation confirmation email");
        }
      } catch (emailError) {
        console.error("❌ Error sending cancellation confirmation email:", emailError);
        // Don't fail the request if email fails
      }

      console.log(`✅ Appointment ${appointment._id} cancelled by patient`);

      return res.status(200).json({
        success: true,
        message: "Appointment cancelled successfully",
        appointment: {
          _id: appointment._id,
          status: appointment.status,
          cancelledAt: appointment.cancelledAt,
          isVideoAppointment,
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

// PATCH /api/appointment-management/:token/reschedule - Reschedule appointment (PUBLIC)
router.patch(
  "/:token/reschedule",
  param("token").isLength({ min: 32, max: 128 }).withMessage("Invalid token format"),
  body("newDate").isISO8601().withMessage("Valid date is required (YYYY-MM-DD format)"),
  body("newSlot").matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage("Valid time slot required (HH:MM format)"),
  body("newDoctorId").optional().isMongoId().withMessage("Valid doctor ID required"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { newDate, newSlot, newDoctorId } = req.body;

      const appointment = await Appointment.findOne({
        managementToken: token,
      }).populate("doctorId", "name");

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found or token is invalid",
        });
      }

      // Check if appointment is cancelled
      if (appointment.status === "cancelled") {
        return res.status(400).json({
          message: "Cannot reschedule a cancelled appointment",
        });
      }

      // Check if appointment is completed
      if (appointment.status === "completed") {
        return res.status(400).json({
          message: "Cannot reschedule a completed appointment",
        });
      }

      // Prepare new appointment date
      const newAppointmentDate = new Date(newDate + "T00:00:00.000Z");
      const currentDoctorId =
        typeof appointment.doctorId === "object" && appointment.doctorId !== null
          ? appointment.doctorId._id || appointment.doctorId
          : appointment.doctorId;
      const targetDoctorId = newDoctorId || currentDoctorId;

      // Check if new doctor exists (if different)
      if (newDoctorId && newDoctorId !== appointment.doctorId._id.toString()) {
        const newDoctor = await Doctor.findById(newDoctorId);
        if (!newDoctor) {
          return res.status(404).json({
            message: "New doctor not found",
          });
        }
      }

      // Check if new slot is available
      const existingAppointment = await Appointment.findOne({
        doctorId: targetDoctorId,
        date: newAppointmentDate,
        slot: newSlot,
        status: { $in: ["scheduled"] },
        _id: { $ne: appointment._id }, // Exclude current appointment
      });

      if (existingAppointment) {
        return res.status(409).json({
          message: "The selected time slot is already booked",
        });
      }

      // Validate new date is not in the past
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (newAppointmentDate < now) {
        return res.status(400).json({
          message: "Cannot reschedule to a past date",
        });
      }

      // Generate NEW management token (invalidate old one)
      const crypto = require("crypto");
      const newManagementToken = crypto.randomBytes(32).toString("hex");

      // Update appointment
      appointment.date = newAppointmentDate;
      appointment.slot = newSlot;
      if (newDoctorId) {
        appointment.doctorId = newDoctorId;
      }
      appointment.managementToken = newManagementToken; // Replace old token
      let targetDoctor = appointment.doctorId;
      if (
        !targetDoctor ||
        (typeof targetDoctor === "object" && !targetDoctor.name) ||
        typeof targetDoctor === "string"
      ) {
        targetDoctor = await Doctor.findById(targetDoctorId).select("name");
      }
      const doctorNameTrimmed =
        targetDoctor && targetDoctor.name ? targetDoctor.name.trim() : "";
      const isVideoDoctor = VIDEO_DOCTOR_NAMES.has(doctorNameTrimmed);
      const newAppointmentDateTimeUtc = getAppointmentDateTimeUtcFromSlot(
        newAppointmentDate,
        newSlot
      );
      appointment.isVideoAppointment =
        isVideoDoctor || isBerlinFriday(newAppointmentDateTimeUtc);
      appointment.updatedAt = new Date();

      await appointment.save();

      const updatedAppointment = await Appointment.findById(appointment._id).populate("doctorId", "name");

      // Send reschedule email with NEW token
      try {
        const { sendAppointmentReschedule } = require("../services/mailer");
        const locale = updatedAppointment.locale || "de";

        if (updatedAppointment.patientEmail) {
          const appointmentData = {
            doctorName: updatedAppointment.doctorId?.name || "N/A",
            date: updatedAppointment.date,
            slot: updatedAppointment.slot,
            managementToken: newManagementToken, // Send NEW token in email
            isVideoAppointment: updatedAppointment.isVideoAppointment,
          };
          await sendAppointmentReschedule(updatedAppointment.patientEmail, appointmentData, locale);
          console.log(`✅ Reschedule email sent to ${updatedAppointment.patientEmail}`);
        } else {
          console.log("⚠️ No patient email found, skipping reschedule email");
        }
      } catch (emailError) {
        console.error("❌ Error sending reschedule email:", emailError);
        // Don't fail the request if email fails
      }

      // Notify practice if appointment is a video consultation
      try {
        const rescheduleDoctorName =
          updatedAppointment?.doctorId?.name?.trim() || "";
        const isVideoDoctorReschedule =
          VIDEO_DOCTOR_NAMES.has(rescheduleDoctorName);
        const isVideoAppointment =
          typeof updatedAppointment.isVideoAppointment === "boolean"
            ? updatedAppointment.isVideoAppointment || isVideoDoctorReschedule
            : isVideoDoctorReschedule ||
              isBerlinFriday(getAppointmentDateTimeUtc(updatedAppointment));

        if (isVideoAppointment) {
          const appointmentDateTimeUtc = getAppointmentDateTimeUtc(
            updatedAppointment
          );
          const { formattedDate, formattedTime } =
            getBerlinFormattedDetails(appointmentDateTimeUtc);

          await sendFridayVideoNotification({
            doctorName: updatedAppointment.doctorId?.name || "N/A",
            formattedDate,
            formattedTime,
            patientName: updatedAppointment.patientName || "Patient",
            patientEmail: updatedAppointment.patientEmail || "",
            patientPhone: updatedAppointment.patientPhone || "",
            insuranceType: updatedAppointment.description || "",
            insuranceNumber: "",
            notes: updatedAppointment.notes || "",
          });
          console.log(
            `📬 Video consultation notification sent (reschedule) for ${updatedAppointment.patientEmail}`
          );
        }
      } catch (notifyError) {
        console.error(
          "❌ Error sending video consultation notification after reschedule:",
          notifyError
        );
      }

      return res.status(200).json({
        success: true,
        message: "Appointment rescheduled successfully",
        appointment: {
          _id: updatedAppointment._id,
          doctorId: updatedAppointment.doctorId,
          date: updatedAppointment.date,
          slot: updatedAppointment.slot,
          status: updatedAppointment.status,
          updatedAt: updatedAppointment.updatedAt,
          isVideoAppointment: updatedAppointment.isVideoAppointment,
        },
      });
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      return res.status(500).json({
        message: "Error rescheduling appointment",
        error: error.message,
      });
    }
  }
);

// GET /api/appointment-management/available-slots - Get available slots for rescheduling (PUBLIC)
router.get(
  "/available-slots/:doctorId",
  param("doctorId").isMongoId().withMessage("Valid doctor ID required"),
  query("date").isISO8601().withMessage("Valid date is required (YYYY-MM-DD format)"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { date } = req.query;

      // Check if doctor exists
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      const appointmentDate = new Date(date + "T00:00:00.000Z");

      // Get availabilities from database
      const Availability = require("../models/Availability");
      const availability = await Availability.findOne({
        doctorId,
        date: appointmentDate,
      });

      // If no availability set for this date, return empty array
      if (!availability || !availability.slots || availability.slots.length === 0) {
        return res.status(200).json({
          success: true,
          date,
          doctorId,
          doctorName: doctor.name,
          availableSlots: [],
        });
      }

      // Get all booked appointments for this doctor on this date
      const bookedAppointments = await Appointment.find({
        doctorId,
        date: appointmentDate,
        status: { $in: ["scheduled"] },
      }).select("slot");

      const bookedSlots = bookedAppointments.map((apt) => apt.slot);

      // Filter out booked slots from available slots
      let availableSlots = availability.slots.filter((slot) => !bookedSlots.includes(slot));

      // Filter out past time slots if the date is today
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (appointmentDate.getTime() === today.getTime()) {
        // Only show future slots for today
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        
        availableSlots = availableSlots.filter((slot) => {
          const [hours, minutes] = slot.split(':').map(Number);
          const slotTimeInMinutes = hours * 60 + minutes;
          return slotTimeInMinutes > currentTimeInMinutes;
        });
      }

      return res.status(200).json({
        success: true,
        date,
        doctorId,
        doctorName: doctor.name,
        availableSlots,
      });
    } catch (error) {
      console.error("Error fetching available slots:", error);
      return res.status(500).json({
        message: "Error fetching available slots",
        error: error.message,
      });
    }
  }
);

module.exports = router;

