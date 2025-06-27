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

  // Meeting is joinable 20 minutes before the start time
  const joinableTimeUTC = new Date(
    appointmentDateUTC.getTime() - 20 * 60 * 1000
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

  // Meeting is joinable 20 minutes before the start time
  const joinableTimeUTC = new Date(
    appointmentDateUTC.getTime() - 20 * 60 * 1000
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

module.exports = {
  isJoinable,
  getMinutesUntilJoinable,
  hasAppointmentPassed,
};
