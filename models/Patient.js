const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create text index for search functionality
patientSchema.index({ name: "text", email: "text", phone: "text" });

// Create compound index for common queries
patientSchema.index({ email: 1, createdAt: -1 });
patientSchema.index({ name: 1, createdAt: -1 });

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
