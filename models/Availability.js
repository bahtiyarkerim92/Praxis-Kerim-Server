const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  slots: [
    {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format validation
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create compound index for doctor and date
availabilitySchema.index({ doctorId: 1, date: 1 }, { unique: true });

// Update the updatedAt field before saving
availabilitySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Availability = mongoose.model("Availability", availabilitySchema);

module.exports = Availability;
