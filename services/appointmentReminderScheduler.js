const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const { sendAppointmentReminder } = require("./mailer");

/**
 * Appointment Reminder Scheduler - Production Ready
 *
 * Sends automatic reminders 24 hours and 2 hours before appointments
 *
 * Features:
 * - Duplicate prevention with in-memory tracking
 * - Automatic cleanup of old tracking data
 * - Comprehensive error handling
 * - Detailed logging with timestamps
 * - Environment-based configuration
 * - Configurable via environment variables
 */

// Track sent reminders to avoid duplicates (in-memory)
const sentReminders = new Set();

// Production configuration from environment variables
const PRODUCTION_MODE = process.env.NODE_ENV === "production";
const REMINDER_CHECK_INTERVAL =
  process.env.REMINDER_CHECK_INTERVAL || "*/30 * * * *"; // Default: every 30 minutes
const ENABLE_24H_REMINDERS = process.env.ENABLE_24H_REMINDERS !== "false"; // Default: true
const ENABLE_2H_REMINDERS = process.env.ENABLE_2H_REMINDERS !== "false"; // Default: true

const VIDEO_DOCTOR_NAMES = new Set(["M. Cem Samar"]);

function getReminderKey(appointmentId, type) {
  return `${appointmentId}_${type}`;
}

async function checkAndSendReminders() {
  const now = new Date();
  const timestamp = now.toISOString();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${timestamp}] 🔄 Checking for appointment reminders...`);
  console.log(`${"=".repeat(60)}`);

  // Calculate time windows (with 30-minute buffer for safety)
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in24HoursPlus30Min = new Date(
    now.getTime() + (24 * 60 + 30) * 60 * 1000
  );

  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in2HoursPlus30Min = new Date(now.getTime() + (2 * 60 + 30) * 60 * 1000);

  let totalSent = 0;
  let totalFailed = 0;

  try {
    // ==================== 24-HOUR REMINDERS ====================
    if (ENABLE_24H_REMINDERS) {
      const appointments24h = await Appointment.find({
        date: {
          $gte: in24Hours,
          $lte: in24HoursPlus30Min,
        },
        status: { $in: ["pending", "confirmed"] },
      }).populate("doctorId", "name");

      console.log(
        `\n📋 24-Hour Reminders: Found ${appointments24h.length} appointments`
      );

      for (const appointment of appointments24h) {
        const reminderKey = getReminderKey(appointment._id, "24h");

        if (!sentReminders.has(reminderKey)) {
          try {
            const patientName =
              `${appointment.patient.firstName || ""} ${appointment.patient.lastName || ""}`.trim() ||
              "Patient";
            const doctorNameTrimmed = appointment.doctorId?.name
              ? appointment.doctorId.name.trim()
              : "";
            const isVideoDoctor = VIDEO_DOCTOR_NAMES.has(doctorNameTrimmed);
            const isVideoAppointment =
              appointment.isVideoAppointment || isVideoDoctor;

            await sendAppointmentReminder(
              appointment.patient.email,
              {
                patientName,
                doctorName: appointment.doctorId?.name || "Dr. Kerim",
                date: appointment.date,
                slot: appointment.slot,
                isVideoAppointment,
              },
              "24h",
              appointment.patient.locale || "de"
            );

            sentReminders.add(reminderKey);
            totalSent++;
            console.log(
              `  ✅ Sent to ${appointment.patient.email} | Appointment: ${appointment._id.toString().substring(0, 8)}...`
            );
          } catch (error) {
            totalFailed++;
            console.error(
              `  ❌ Failed for ${appointment.patient.email} | Error: ${error.message}`
            );
          }
        } else {
          console.log(`  ⏭️  Already sent to ${appointment.patient.email}`);
        }
      }
    } else {
      console.log(
        `\n⚠️  24-hour reminders are DISABLED (set ENABLE_24H_REMINDERS=true to enable)`
      );
    }

    // ==================== 2-HOUR REMINDERS ====================
    if (ENABLE_2H_REMINDERS) {
      const appointments2h = await Appointment.find({
        date: {
          $gte: in2Hours,
          $lte: in2HoursPlus30Min,
        },
        status: { $in: ["pending", "confirmed"] },
      }).populate("doctorId", "name");

      console.log(
        `\n📋 2-Hour Reminders: Found ${appointments2h.length} appointments`
      );

      for (const appointment of appointments2h) {
        const reminderKey = getReminderKey(appointment._id, "2h");

        if (!sentReminders.has(reminderKey)) {
          try {
            const patientName =
              `${appointment.patient.firstName || ""} ${appointment.patient.lastName || ""}`.trim() ||
              "Patient";
            const doctorNameTrimmed = appointment.doctorId?.name
              ? appointment.doctorId.name.trim()
              : "";
            const isVideoDoctor = VIDEO_DOCTOR_NAMES.has(doctorNameTrimmed);
            const isVideoAppointment =
              appointment.isVideoAppointment || isVideoDoctor;

            await sendAppointmentReminder(
              appointment.patient.email,
              {
                patientName,
                doctorName: appointment.doctorId?.name || "Dr. Kerim",
                date: appointment.date,
                slot: appointment.slot,
                isVideoAppointment,
              },
              "2h",
              appointment.patient.locale || "de"
            );

            sentReminders.add(reminderKey);
            totalSent++;
            console.log(
              `  ✅ Sent to ${appointment.patient.email} | Appointment: ${appointment._id.toString().substring(0, 8)}...`
            );
          } catch (error) {
            totalFailed++;
            console.error(
              `  ❌ Failed for ${appointment.patient.email} | Error: ${error.message}`
            );
          }
        } else {
          console.log(`  ⏭️  Already sent to ${appointment.patient.email}`);
        }
      }
    } else {
      console.log(
        `\n⚠️  2-hour reminders are DISABLED (set ENABLE_2H_REMINDERS=true to enable)`
      );
    }

    // ==================== CLEANUP OLD TRACKING DATA ====================
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const oldAppointments = await Appointment.find({
      date: { $lt: twoDaysAgo },
    }).select("_id");

    let cleanedCount = 0;
    for (const apt of oldAppointments) {
      const deleted24h = sentReminders.delete(getReminderKey(apt._id, "24h"));
      const deleted2h = sentReminders.delete(getReminderKey(apt._id, "2h"));
      if (deleted24h || deleted2h) cleanedCount++;
    }

    if (cleanedCount > 0) {
      console.log(
        `\n🧹 Cleaned up ${cleanedCount} old reminder tracking entries`
      );
    }

    // ==================== SUMMARY ====================
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Summary: ${totalSent} sent, ${totalFailed} failed`);
    console.log(`💾 Tracking ${sentReminders.size} sent reminders in memory`);
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error(`\n❌ CRITICAL ERROR in reminder scheduler:`);
    console.error(error);
    console.error(`\n${"=".repeat(60)}\n`);
  }
}

/**
 * Start the reminder scheduler
 * Production-ready with configurable interval and error handling
 */
function startReminderScheduler() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("📅 APPOINTMENT REMINDER SCHEDULER");
  console.log(`${"=".repeat(60)}`);
  console.log(
    `Environment: ${PRODUCTION_MODE ? "PRODUCTION 🚀" : "DEVELOPMENT 🔧"}`
  );
  console.log(`Schedule: ${REMINDER_CHECK_INTERVAL}`);
  console.log(
    `24h Reminders: ${ENABLE_24H_REMINDERS ? "ENABLED ✅" : "DISABLED ❌"}`
  );
  console.log(
    `2h Reminders: ${ENABLE_2H_REMINDERS ? "ENABLED ✅" : "DISABLED ❌"}`
  );
  console.log(`${"=".repeat(60)}\n`);

  // Validate cron expression
  if (!cron.validate(REMINDER_CHECK_INTERVAL)) {
    console.error(`❌ Invalid cron expression: ${REMINDER_CHECK_INTERVAL}`);
    console.error(`   Defaulting to: */30 * * * * (every 30 minutes)\n`);
  }

  // Run immediately on startup (after 5 seconds to let DB initialize)
  setTimeout(() => {
    console.log("🚀 Running initial reminder check...");
    checkAndSendReminders().catch((err) => {
      console.error("❌ Error in initial reminder check:", err);
    });
  }, 5000);

  // Schedule recurring checks
  const schedule = cron.validate(REMINDER_CHECK_INTERVAL)
    ? REMINDER_CHECK_INTERVAL
    : "*/30 * * * *";

  cron.schedule(schedule, () => {
    checkAndSendReminders().catch((err) => {
      console.error("❌ Error in scheduled reminder check:", err);
    });
  });

  console.log("✅ Reminder scheduler started successfully!");
  console.log(`   Next check will run according to schedule: ${schedule}\n`);
}

module.exports = { startReminderScheduler };
