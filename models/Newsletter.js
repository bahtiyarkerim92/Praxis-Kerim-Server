const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // Can be null for non-registered subscribers
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  source: {
    type: String,
    enum: ["registration", "manual", "landing_page"],
    default: "registration",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  unsubscribedAt: {
    type: Date,
    default: null,
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ isActive: 1 });

const Newsletter = mongoose.model("Newsletter", newsletterSchema);

module.exports = Newsletter;

