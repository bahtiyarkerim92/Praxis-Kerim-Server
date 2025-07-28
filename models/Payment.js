const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  // Patient and appointment references
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
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },

  // Stripe payment details
  stripeSessionId: {
    type: String,
    required: true,
    unique: true,
  },
  stripePaymentIntentId: {
    type: String,
    default: "",
  },
  stripeCustomerId: {
    type: String,
    default: "",
  },

  // Payment amount and currency
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    enum: ["BGN", "EUR"],
  },
  country: {
    type: String,
    required: true,
    enum: ["Bulgaria", "Germany"],
  },

  // Payment status
  status: {
    type: String,
    required: true,
    enum: ["pending", "completed", "failed", "cancelled", "refunded"],
    default: "pending",
  },

  // Appointment booking details
  appointmentDate: {
    type: Date,
    required: true,
  },
  appointmentSlot: {
    type: String,
    required: true,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
  refundedAt: {
    type: Date,
  },

  // Stripe metadata
  stripeMetadata: {
    type: Object,
    default: {},
  },

  // Error tracking
  errorMessage: {
    type: String,
    default: "",
  },
  errorCode: {
    type: String,
    default: "",
  },
});

// Create compound index for efficient queries
paymentSchema.index({ patientId: 1, appointmentId: 1 });
paymentSchema.index({ stripeSessionId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

// Update timestamps based on status changes
paymentSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const now = Date.now();
    switch (this.status) {
      case "completed":
        this.completedAt = now;
        break;
      case "failed":
        this.failedAt = now;
        break;
      case "cancelled":
        this.cancelledAt = now;
        break;
      case "refunded":
        this.refundedAt = now;
        break;
    }
  }
  next();
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
