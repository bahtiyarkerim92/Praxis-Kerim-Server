/**
 * Convert appointment slot time (local Bulgaria time) to UTC
 * @param {Date} appointmentDate - The appointment date (UTC start of day)
 * @param {string} slot - Time slot in HH:MM format (Bulgaria local time)
 * @returns {Date} Appointment datetime in UTC
 */
function convertSlotToUTC(appointmentDate, slot) {
  const [hours, minutes] = slot.split(":").map(Number);

  // Create date in Bulgaria timezone (UTC+3)
  // Since appointmentDate is UTC start of day, we need to add the Bulgaria offset
  const appointmentDateUTC = new Date(appointmentDate);

  // Convert Bulgaria local time to UTC: subtract 3 hours
  // Bulgaria time 13:00 = UTC time 10:00
  appointmentDateUTC.setUTCHours(hours - 3, minutes, 0, 0);

  return appointmentDateUTC;
}

/**
 * Check if an appointment is joinable based on current time (UTC)
 * @param {Object} appointment - The appointment object
 * @returns {boolean} Whether the appointment can be joined
 */
function isJoinable(appointment) {
  if (
    !appointment.date ||
    !appointment.slot ||
    appointment.plan !== "consultation"
  ) {
    return false;
  }

  // Get current UTC time
  const nowUTC = new Date();

  // Convert slot time (Bulgaria local time) to UTC
  const appointmentDateUTC = convertSlotToUTC(
    appointment.date,
    appointment.slot
  );

  // Meeting is joinable 5 minutes before the start time
  const joinableTimeUTC = new Date(
    appointmentDateUTC.getTime() - 5 * 60 * 1000
  );

  // Meeting stays joinable for 2 hours after start time
  const endTimeUTC = new Date(
    appointmentDateUTC.getTime() + 2 * 60 * 60 * 1000
  );

  return nowUTC >= joinableTimeUTC && nowUTC <= endTimeUTC;
}

/**
 * Get time until appointment is joinable (in minutes, UTC-based)
 * @param {Object} appointment - The appointment object
 * @returns {number} Minutes until joinable, negative if already joinable
 */
function getMinutesUntilJoinable(appointment) {
  if (!appointment.date || !appointment.slot) {
    return Infinity;
  }

  // Get current UTC time
  const nowUTC = new Date();

  // Convert slot time (Bulgaria local time) to UTC
  const appointmentDateUTC = convertSlotToUTC(
    appointment.date,
    appointment.slot
  );

  // Meeting is joinable 5 minutes before the start time
  const joinableTimeUTC = new Date(
    appointmentDateUTC.getTime() - 5 * 60 * 1000
  );

  return Math.ceil(
    (joinableTimeUTC.getTime() - nowUTC.getTime()) / (60 * 1000)
  );
}

/**
 * Check if appointment has passed (UTC-based)
 * @param {Object} appointment - The appointment object
 * @returns {boolean} Whether the appointment has passed
 */
function hasAppointmentPassed(appointment) {
  if (!appointment.date || !appointment.slot) {
    return false;
  }

  // Get current UTC time
  const nowUTC = new Date();

  // Convert slot time (Bulgaria local time) to UTC
  const appointmentDateUTC = convertSlotToUTC(
    appointment.date,
    appointment.slot
  );

  // Add 2 hours grace period after appointment
  const endTimeUTC = new Date(
    appointmentDateUTC.getTime() + 2 * 60 * 60 * 1000
  );

  return nowUTC > endTimeUTC;
}

/**
 * Check if an appointment should be auto-completed (30 minutes after start)
 * @param {Object} appointment - The appointment object
 * @returns {boolean} Whether the appointment should be completed
 */
function shouldAutoComplete(appointment) {
  if (
    !appointment.date ||
    !appointment.slot ||
    appointment.status !== "upcoming"
  ) {
    return false;
  }

  // Get current UTC time
  const nowUTC = new Date();

  // Convert slot time (Bulgaria local time) to UTC
  const appointmentDateUTC = convertSlotToUTC(
    appointment.date,
    appointment.slot
  );

  // Auto-complete 30 minutes after start time
  const autoCompleteTimeUTC = new Date(
    appointmentDateUTC.getTime() + 30 * 60 * 1000
  );

  return nowUTC >= autoCompleteTimeUTC;
}

const Appointment = require("../models/Appointment");

/**
 * Auto-complete appointments that have passed their scheduled time + 30 minutes
 * This should be called periodically (e.g., every 15 minutes) via a cron job
 */
const autoCompleteAppointments = async () => {
  try {
    console.log("Running auto-complete check for appointments...");

    // Get current time
    const now = new Date();

    // Find confirmed consultation appointments that should be auto-completed
    const appointmentsToComplete = await Appointment.find({
      status: "confirmed",
      plan: "consultation", // Only consultation appointments (video calls)
    })
      .populate("doctorId", "name email")
      .populate("patientId", "firstName lastName email");

    let completedCount = 0;

    for (const appointment of appointmentsToComplete) {
      // Parse appointment date and time
      const appointmentDate = new Date(appointment.date);
      const [hours, minutes] = appointment.slot.split(":").map(Number);

      // Create appointment datetime in UTC
      const appointmentDateTime = new Date(appointmentDate);
      appointmentDateTime.setUTCHours(hours, minutes, 0, 0);

      // Calculate time 30 minutes after appointment
      const completionTime = new Date(
        appointmentDateTime.getTime() + 30 * 60 * 1000
      );

      // Check if current time is past completion time
      if (now >= completionTime) {
        console.log(
          `Auto-completing appointment ${appointment._id} - scheduled for ${appointmentDateTime.toISOString()}, completion time was ${completionTime.toISOString()}`
        );

        appointment.status = "completed";
        appointment.completedAt = now;
        appointment.notes =
          (appointment.notes || "") +
          `\n[Auto-completed] Appointment automatically marked as completed 30 minutes after scheduled time.`;

        await appointment.save();
        completedCount++;

        // Log the completion
        console.log(
          `✅ Auto-completed appointment for patient ${appointment.patientId.firstName} ${appointment.patientId.lastName} with Dr. ${appointment.doctorId.name}`
        );
      }
    }

    if (completedCount > 0) {
      console.log(`Auto-completed ${completedCount} appointments`);
    } else {
      console.log("No appointments to auto-complete");
    }

    return {
      success: true,
      completedCount,
      message: `Auto-completed ${completedCount} appointments`,
    };
  } catch (error) {
    console.error("Error in auto-complete appointments:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get appointments that are due for auto-completion (for monitoring)
 */
const getAppointmentsDueForCompletion = async () => {
  try {
    const now = new Date();

    const appointmentsDue = await Appointment.find({
      status: "confirmed",
      plan: "consultation",
    })
      .populate("doctorId", "name email")
      .populate("patientId", "firstName lastName email");

    const due = [];

    for (const appointment of appointmentsDue) {
      const appointmentDate = new Date(appointment.date);
      const [hours, minutes] = appointment.slot.split(":").map(Number);

      const appointmentDateTime = new Date(appointmentDate);
      appointmentDateTime.setUTCHours(hours, minutes, 0, 0);

      const completionTime = new Date(
        appointmentDateTime.getTime() + 30 * 60 * 1000
      );

      if (now >= completionTime) {
        due.push({
          id: appointment._id,
          patient: `${appointment.patientId.firstName} ${appointment.patientId.lastName}`,
          doctor: appointment.doctorId.name,
          scheduledFor: appointmentDateTime,
          shouldCompleteAt: completionTime,
          overdue: Math.floor((now - completionTime) / (60 * 1000)), // minutes overdue
        });
      }
    }

    return {
      success: true,
      count: due.length,
      appointments: due,
    };
  } catch (error) {
    console.error("Error checking appointments due for completion:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  isJoinable,
  getMinutesUntilJoinable,
  hasAppointmentPassed,
  shouldAutoComplete,
  autoCompleteAppointments,
  getAppointmentsDueForCompletion,
};
