const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: false, // Will be auto-generated
      unique: true,
      uppercase: true,
      match: /^TELE\d{6}$/, // Format: TELE000001
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    status: {
      type: String,
      enum: ["unconfirmed", "active", "used", "expired", "rejected"],
      default: "unconfirmed",
    },
    // Approval tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null, // Admin doctor who approved
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    // Usage tracking
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Patient who used the coupon
    },
    usedAt: {
      type: Date,
      default: null,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null, // Appointment where coupon was used
    },
    // Coupon details
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "Free consultation coupon",
    },
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        // Default expiration: 30 days from creation
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      },
    },
    // BG/DE compliance
    isAnonymous: {
      type: Boolean,
      default: true, // For privacy compliance
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ doctorId: 1, status: 1 });
couponSchema.index({ status: 1, expiresAt: 1 });
couponSchema.index({ usedBy: 1 });

// Auto-generate coupon code before saving
couponSchema.pre("save", async function (next) {
  if (this.isNew && !this.code) {
    try {
      console.log("🎫 Auto-generating coupon code...");

      // Find the highest existing coupon number
      const lastCoupon = await mongoose
        .model("Coupon")
        .findOne({ code: /^TELE\d{6}$/ })
        .sort({ code: -1 })
        .select("code");

      console.log("🔍 Last coupon found:", lastCoupon);

      let nextNumber = 1;
      if (lastCoupon && lastCoupon.code) {
        const lastNumber = parseInt(lastCoupon.code.replace("TELE", ""));
        nextNumber = lastNumber + 1;
      }

      // Generate new code with zero-padding
      this.code = `TELE${nextNumber.toString().padStart(6, "0")}`;

      console.log("✅ Generated coupon code:", this.code);
    } catch (error) {
      console.error("❌ Error generating coupon code:", error);
      return next(error);
    }
  }
  next();
});

// Virtual for checking if coupon is valid for use
couponSchema.virtual("isValid").get(function () {
  return (
    this.status === "active" && new Date() < this.expiresAt && !this.usedBy
  );
});

// Virtual for human-readable status
couponSchema.virtual("statusDisplay").get(function () {
  switch (this.status) {
    case "unconfirmed":
      return "Pending Approval";
    case "active":
      return this.usedBy ? "Used" : "Active";
    case "used":
      return "Used";
    case "expired":
      return "Expired";
    case "rejected":
      return "Rejected";
    default:
      return this.status;
  }
});

// Ensure virtuals are included in JSON output
couponSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Coupon", couponSchema);
