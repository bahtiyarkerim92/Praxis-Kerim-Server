/**
 * Check if an appointment is joinable based on current time
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

  const now = new Date();

  // Parse the slot time (HH:MM format)
  const [hours, minutes] = appointment.slot.split(":").map(Number);

  // Create the appointment start time
  const appointmentDate = new Date(appointment.date);
  appointmentDate.setHours(hours, minutes, 0, 0);

  // Meeting is joinable 20 minutes before the start time
  const joinableTime = new Date(appointmentDate.getTime() - 20 * 60 * 1000);

  // Meeting stays joinable for 2 hours after start time
  const endTime = new Date(appointmentDate.getTime() + 2 * 60 * 60 * 1000);

  return now >= joinableTime && now <= endTime;
}

/**
 * Get time until appointment is joinable (in minutes)
 * @param {Object} appointment - The appointment object
 * @returns {number} Minutes until joinable, negative if already joinable
 */
function getMinutesUntilJoinable(appointment) {
  if (!appointment.date || !appointment.slot) {
    return Infinity;
  }

  const now = new Date();

  // Parse the slot time (HH:MM format)
  const [hours, minutes] = appointment.slot.split(":").map(Number);

  // Create the appointment start time
  const appointmentDate = new Date(appointment.date);
  appointmentDate.setHours(hours, minutes, 0, 0);

  // Meeting is joinable 20 minutes before the start time
  const joinableTime = new Date(appointmentDate.getTime() - 20 * 60 * 1000);

  return Math.ceil((joinableTime.getTime() - now.getTime()) / (60 * 1000));
}

/**
 * Check if appointment has passed
 * @param {Object} appointment - The appointment object
 * @returns {boolean} Whether the appointment has passed
 */
function hasAppointmentPassed(appointment) {
  if (!appointment.date || !appointment.slot) {
    return false;
  }

  const now = new Date();

  // Parse the slot time (HH:MM format)
  const [hours, minutes] = appointment.slot.split(":").map(Number);

  // Create the appointment start time
  const appointmentDate = new Date(appointment.date);
  appointmentDate.setHours(hours, minutes, 0, 0);

  // Add 2 hours grace period after appointment
  const endTime = new Date(appointmentDate.getTime() + 2 * 60 * 60 * 1000);

  return now > endTime;
}

module.exports = {
  isJoinable,
  getMinutesUntilJoinable,
  hasAppointmentPassed,
};
