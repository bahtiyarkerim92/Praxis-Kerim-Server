const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    description: {
      type: String,
      default: "Free consultation coupon",
      trim: true,
    },
    status: {
      type: String,
      enum: ["unconfirmed", "active", "used", "rejected"],
      default: "unconfirmed",
    },
    // Expiration date - defaults to 30 days from creation
    expiresAt: {
      type: Date,
      default: function () {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      },
    },
    // Usage tracking
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    // Approval tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    // Rejection tracking
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique coupon code before saving
couponSchema.pre("save", async function (next) {
  if (!this.code) {
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate 8-character alphanumeric code
      const code = generateCouponCode();

      // Check if code already exists
      const existingCoupon = await mongoose.model("Coupon").findOne({ code });

      if (!existingCoupon) {
        this.code = code;
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new Error("Failed to generate unique coupon code");
    }
  }

  next();
});

// Virtual property to check if coupon is valid
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  return this.status === "active" && this.expiresAt > now && !this.usedBy;
});

// Ensure virtuals are included in JSON responses
couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

// Index for efficient queries
couponSchema.index({ code: 1 });
couponSchema.index({ doctorId: 1, status: 1 });
couponSchema.index({ usedBy: 1 });
couponSchema.index({ status: 1, createdAt: -1 });

/**
 * Generate a random 8-character alphanumeric coupon code
 * Format: XXXX-XXXX for readability
 */
function generateCouponCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 8; i++) {
    if (i === 4) {
      code += "-";
    }
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

module.exports = mongoose.model("Coupon", couponSchema);
