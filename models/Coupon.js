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

// Generate sequential coupon code before validation (so it passes required check)
couponSchema.pre("validate", async function (next) {
  if (!this.code) {
    try {
      // Find the highest coupon number
      const lastCoupon = await mongoose.model("Coupon")
        .findOne({})
        .sort({ code: -1 })
        .select("code");

      let nextNumber = 1;

      if (lastCoupon && lastCoupon.code) {
        // Extract the number from the code (e.g., TELE000001 -> 1)
        const match = lastCoupon.code.match(/TELE(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Generate code with format TELE000001
      this.code = `TELE${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(new Error("Failed to generate coupon code: " + error.message));
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


module.exports = mongoose.model("Coupon", couponSchema);
