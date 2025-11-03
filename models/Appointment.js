const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  slot: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format validation
  },
  patientEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Email format validation
  },
  patientName: {
    type: String,
    trim: true,
  },
  patientPhone: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["scheduled", "cancelled", "completed"],
    default: "scheduled",
  },
  title: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  cancelledAt: {
    type: Date,
  },
  cancelReason: {
    type: String,
    trim: true,
  },
  completedAt: {
    type: Date,
  },
});

// Create compound index for doctor, date, and slot to prevent double booking
appointmentSchema.index({ doctorId: 1, date: 1, slot: 1 }, { unique: true });

// Update the updatedAt field before saving
appointmentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Set timestamp based on status change
  if (this.isModified("status")) {
    const now = Date.now();
    switch (this.status) {
      case "confirmed":
        this.confirmedAt = now;
        break;
      case "cancelled":
        this.cancelledAt = now;
        break;
      case "completed":
        this.completedAt = now;
        break;
    }
  }

  next();
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
