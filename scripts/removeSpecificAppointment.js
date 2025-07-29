const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
require("dotenv").config();

async function removeSpecificAppointment() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.DATABASE_URL || "mongodb://localhost:27017/telemedker"
    );
    console.log("✅ Connected to MongoDB");

    // The specific appointment causing the conflict
    const conflictingAppointment = {
      doctorId: new mongoose.Types.ObjectId("685aa0bea2654bfd77804ebb"),
      date: new Date("2025-07-31T00:00:00.000Z"),
      slot: "09:00",
    };

    console.log("🔍 Looking for conflicting appointment:");
    console.log(`   Doctor ID: ${conflictingAppointment.doctorId}`);
    console.log(`   Date: ${conflictingAppointment.date.toISOString()}`);
    console.log(`   Slot: ${conflictingAppointment.slot}`);

    // Find the conflicting appointment
    const existingAppointment = await Appointment.findOne(
      conflictingAppointment
    )
      .populate("doctorId", "name")
      .populate("patientId", "firstName lastName email");

    if (existingAppointment) {
      console.log("\n🚨 Found conflicting appointment:");
      console.log(`   ID: ${existingAppointment._id}`);
      console.log(`   Status: ${existingAppointment.status}`);
      console.log(
        `   Doctor: ${existingAppointment.doctorId?.name || "Unknown"}`
      );
      console.log(
        `   Patient: ${existingAppointment.patientId?.firstName || "Unknown"} ${existingAppointment.patientId?.lastName || ""}`
      );
      console.log(`   Created: ${existingAppointment.createdAt}`);
      console.log(`   Payment ID: ${existingAppointment.paymentId || "None"}`);

      // Cancel the appointment instead of deleting it
      const result = await Appointment.updateOne(
        { _id: existingAppointment._id },
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: "system",
          cancelReason: "Duplicate slot conflict - manual cleanup",
        }
      );

      if (result.modifiedCount > 0) {
        console.log("\n✅ Successfully cancelled the conflicting appointment");
      } else {
        console.log("\n❌ Failed to cancel the appointment");
      }
    } else {
      console.log(
        "\n✅ No conflicting appointment found - the slot should be available now"
      );
    }

    // Also do a general cleanup of any other pending_payment conflicts
    const cleanupResult = await Appointment.updateMany(
      {
        status: "pending_payment",
        $or: [
          { paymentId: { $exists: false } },
          { createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } },
        ],
      },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancelReason: "General cleanup - expired or orphaned",
      }
    );

    console.log(
      `\n🧹 General cleanup: ${cleanupResult.modifiedCount} additional appointments cancelled`
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the cleanup
removeSpecificAppointment();
