const mongoose = require("mongoose");

const sickNoteSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  validFrom: {
    type: Date,
    required: true,
  },
  validTo: {
    type: Date,
    required: true,
  },
  diagnosis: {
    type: String,
    trim: true,
  },

  // Multiple diagnoses support
  diagnoses: [
    {
      type: String,
      trim: true,
    },
  ],
  restrictions: {
    type: String,
    trim: true,
  },
  pdfUrl: {
    type: String,
    required: true,
  },
  pdfKey: {
    type: String,
    required: true,
  },
  originalFileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "expired", "cancelled"],
    default: "active",
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

// Update the updatedAt field before saving
sickNoteSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if the sick note is currently valid
sickNoteSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.validFrom <= now && now <= this.validTo && this.status === "active"
  );
});

// Virtual for getting the duration in days
sickNoteSchema.virtual("durationDays").get(function () {
  const timeDiff = this.validTo.getTime() - this.validFrom.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
});

// Index for efficient querying
sickNoteSchema.index({ patientId: 1, createdAt: -1 });
sickNoteSchema.index({ doctorId: 1, createdAt: -1 });
sickNoteSchema.index({ validFrom: 1, validTo: 1 });

// Ensure virtual fields are included in JSON output
sickNoteSchema.set("toJSON", { virtuals: true });
sickNoteSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("SickNote", sickNoteSchema);
