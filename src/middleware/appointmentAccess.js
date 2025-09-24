// @ts-check
// Requires: req.user injected by your auth middleware
// Validate: user is participant of appointment AND within time window.
const {
  differenceInMinutes,
  isAfter,
  subMinutes,
  addMinutes,
} = require("date-fns");
const Appointment = require("../../models/Appointment");

async function appointmentAccess(req, res, next) {
  try {
    const appointmentId = req.body.appointmentId || req.query.appointmentId;
    if (!appointmentId)
      return res
        .status(400)
        .json({ success: false, message: "appointmentId required" });

    const appt = await Appointment.findById(appointmentId).lean();
    if (!appt)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    const uid = String(req.user?._id || "");
    const isParticipant = [
      String(appt.patientId),
      String(appt.doctorId),
    ].includes(uid);
    if (!isParticipant)
      return res
        .status(403)
        .json({ success: false, message: "Not a participant" });

    const beforeMin = Number(process.env.FILE_TRANSFER_WINDOW_BEFORE_MIN || 15);
    const afterMin = Number(process.env.FILE_TRANSFER_WINDOW_AFTER_MIN || 60);

    // Parse appointment date and time
    const appointmentDate = new Date(appt.date);
    const [hours, minutes] = (appt.slot || "00:00").split(":");
    const start = new Date(appointmentDate);
    start.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Assume 30-minute slots if no end time specified
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    const now = new Date();

    const windowOpen = isAfter(now, subMinutes(start, beforeMin));
    const windowClose = isAfter(addMinutes(end, afterMin), now);
    if (!windowOpen || !windowClose) {
      return res
        .status(403)
        .json({ success: false, message: "Transfer window closed" });
    }

    req.appointment = appt;
    req.userRole = String(uid) === String(appt.doctorId) ? "doctor" : "patient";
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { appointmentAccess };
