const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
require("dotenv").config();

async function debugAppointments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.DATABASE_URL || "mongodb://localhost:27017/telemedker"
    );
    console.log("✅ Connected to MongoDB");

    // Get all appointments
    const allAppointments = await Appointment.find({})
      .populate("doctorId", "name")
      .populate("patientId", "firstName lastName email")
      .sort({ createdAt: -1 });

    console.log(
      `\n📋 Total appointments in database: ${allAppointments.length}\n`
    );

    // Group by status
    const statusGroups = {};
    allAppointments.forEach((apt) => {
      if (!statusGroups[apt.status]) {
        statusGroups[apt.status] = [];
      }
      statusGroups[apt.status].push(apt);
    });

    // Show breakdown by status
    Object.keys(statusGroups).forEach((status) => {
      console.log(
        `🏷️  ${status.toUpperCase()}: ${statusGroups[status].length} appointments`
      );
    });

    // Show recent appointments
    console.log("\n📅 Recent appointments (last 10):");
    console.log("=".repeat(80));

    allAppointments.slice(0, 10).forEach((apt, index) => {
      const doctorName = apt.doctorId?.name || "Unknown Doctor";
      const patientName = apt.patientId
        ? `${apt.patientId.firstName} ${apt.patientId.lastName}`
        : "Unknown Patient";
      const date = new Date(apt.date).toLocaleDateString();

      console.log(
        `${index + 1}. [${apt.status.toUpperCase()}] ${doctorName} | ${date} ${apt.slot}`
      );
      console.log(`   Patient: ${patientName}`);
      console.log(`   Created: ${apt.createdAt.toLocaleString()}`);
      console.log(`   ID: ${apt._id}`);
      console.log("   " + "-".repeat(60));
    });

    // Check for potential conflicts (same doctor, date, slot with active status)
    console.log("\n⚠️  Checking for slot conflicts...");

    const activeAppointments = await Appointment.find({
      status: { $in: ["pending_payment", "upcoming"] },
    }).populate("doctorId", "name");

    const slotMap = {};
    const conflicts = [];

    activeAppointments.forEach((apt) => {
      const key = `${apt.doctorId?._id}_${apt.date.toISOString().split("T")[0]}_${apt.slot}`;

      if (slotMap[key]) {
        conflicts.push({
          slot: `${apt.doctorId?.name} on ${apt.date.toISOString().split("T")[0]} at ${apt.slot}`,
          appointments: [slotMap[key], apt],
        });
      } else {
        slotMap[key] = apt;
      }
    });

    if (conflicts.length > 0) {
      console.log(`\n🚨 Found ${conflicts.length} slot conflicts:`);
      conflicts.forEach((conflict, index) => {
        console.log(`\n${index + 1}. Conflict in ${conflict.slot}:`);
        conflict.appointments.forEach((apt) => {
          console.log(
            `   - ${apt.status} (ID: ${apt._id}) Created: ${apt.createdAt.toLocaleString()}`
          );
        });
      });
    } else {
      console.log("✅ No slot conflicts found");
    }

    // Show cleanup suggestions
    const pendingOld = await Appointment.find({
      status: "pending_payment",
      createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    const pendingOrphaned = await Appointment.find({
      status: "pending_payment",
      paymentId: { $exists: false },
    });

    console.log("\n🧹 Cleanup suggestions:");
    console.log(
      `   - ${pendingOld.length} old pending_payment appointments (>30min old)`
    );
    console.log(
      `   - ${pendingOrphaned.length} orphaned pending_payment appointments (no paymentId)`
    );

    if (pendingOld.length > 0 || pendingOrphaned.length > 0) {
      console.log(
        "\n💡 Run cleanup with: node scripts/cleanupPendingPayments.js"
      );
      console.log(
        "   Or call: POST http://localhost:3030/api/payments/cleanup"
      );
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the debug
debugAppointments();
