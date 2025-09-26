const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    // Prevent duplicate ratings for same appointment
    isAnonymous: {
      type: Boolean,
      default: true, // BG/DE privacy compliance
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate ratings
ratingSchema.index(
  { doctorId: 1, patientId: 1, appointmentId: 1 },
  { unique: true }
);

// Index for efficient queries
ratingSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.model("Rating", ratingSchema);
