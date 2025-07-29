const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
require("dotenv").config();

async function cleanupPendingPayments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.DATABASE_URL || "mongodb://localhost:27017/telemedker"
    );
    console.log("Connected to MongoDB");

    // Find all appointments with pending_payment status
    const pendingAppointments = await Appointment.find({
      status: "pending_payment",
      createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }, // Older than 30 minutes
    });

    console.log(
      `Found ${pendingAppointments.length} pending payment appointments older than 30 minutes`
    );

    if (pendingAppointments.length > 0) {
      // Update them to cancelled status
      const result = await Appointment.updateMany(
        {
          status: "pending_payment",
          createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: "system",
          cancelReason: "Payment session expired - cleanup script",
        }
      );

      console.log(
        `Successfully cancelled ${result.modifiedCount} expired pending appointments`
      );
    }

    // Also clean up any pending_payment appointments without paymentId (likely from old booking flow)
    const orphanedAppointments = await Appointment.find({
      status: "pending_payment",
      paymentId: { $exists: false },
    });

    console.log(
      `Found ${orphanedAppointments.length} orphaned pending payment appointments without payment ID`
    );

    if (orphanedAppointments.length > 0) {
      const orphanResult = await Appointment.updateMany(
        {
          status: "pending_payment",
          paymentId: { $exists: false },
        },
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: "system",
          cancelReason: "Orphaned pending payment - cleanup script",
        }
      );

      console.log(
        `Successfully cancelled ${orphanResult.modifiedCount} orphaned pending appointments`
      );
    }

    console.log("Cleanup completed successfully");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the cleanup
cleanupPendingPayments();
