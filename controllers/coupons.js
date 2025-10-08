const Coupon = require("../models/Coupon");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

// Create a new coupon (Doctor only)
const createCoupon = async (req, res) => {
  try {
    const { description, expiresAt } = req.body;

    // Debug logging removed - authentication working

    const doctorId = req.doctor?._id;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID not found in authentication",
      });
    }

    // Verify user is a doctor or admin
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "User not found",
      });
    }

    // Only doctors (or doctor+admin) can create coupons
    // Admin-only users cannot create coupons
    if (!doctor.isDoctor) {
      return res.status(403).json({
        success: false,
        message:
          "Only doctors can create coupons. Admins can only manage and validate coupons.",
      });
    }

    // Create coupon (code will be auto-generated)
    const coupon = new Coupon({
      doctorId,
      description: description || "Free consultation coupon",
      expiresAt: expiresAt ? new Date(expiresAt) : undefined, // Use default if not provided
      // Auto-approve if doctor has admin role (Doctor & Admin)
      status: doctor.isAdmin && doctor.isDoctor ? "active" : "unconfirmed",
      approvedBy: doctor.isAdmin && doctor.isDoctor ? doctorId : null,
      approvedAt: doctor.isAdmin && doctor.isDoctor ? new Date() : null,
    });

    console.log("🎫 About to save coupon:", {
      doctorId,
      description: coupon.description,
      expiresAt: coupon.expiresAt,
    });

    await coupon.save();

    console.log("✅ Coupon saved successfully:", coupon.code);

    // Populate doctor info for response
    await coupon.populate("doctorId", "name email");

    res.status(201).json({
      success: true,
      message:
        doctor.isAdmin && doctor.isDoctor
          ? "Coupon created and activated successfully!"
          : "Coupon created successfully. Awaiting admin approval.",
      data: coupon,
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create coupon",
    });
  }
};

// Get doctor's coupons (Doctor only)
const getDoctorCoupons = async (req, res) => {
  try {
    const doctorId = req.doctor?._id;

    const coupons = await Coupon.find({ doctorId })
      .populate("doctorId", "name email")
      .populate("usedBy", "firstName lastName email")
      .populate("approvedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: coupons,
      count: coupons.length,
    });
  } catch (error) {
    console.error("Error fetching doctor coupons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

// Get all coupons for admin approval (Admin doctors only)
const getAllCouponsForApproval = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    // Filter by status if provided
    if (status) {
      filter.status = status;
    } else {
      // Default: show pending coupons for approval
      filter.status = "unconfirmed";
    }

    const coupons = await Coupon.find(filter)
      .populate("doctorId", "name email specialties")
      .populate("usedBy", "firstName lastName email")
      .populate("approvedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: coupons,
      count: coupons.length,
    });
  } catch (error) {
    console.error("Error fetching coupons for approval:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

// Approve/Reject coupon (Admin doctors only)
const updateCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { status, rejectionReason } = req.body;
    const adminId = req.doctor?._id;

    // Verify admin status
    const admin = await Doctor.findById(adminId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    // Validate status
    if (!["active", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active' or 'rejected'",
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Update coupon status
    coupon.status = status;
    coupon.approvedBy = adminId;

    if (status === "active") {
      coupon.approvedAt = new Date();
    } else if (status === "rejected") {
      coupon.rejectedAt = new Date();
      coupon.rejectionReason = rejectionReason;
    }

    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${status === "active" ? "approved" : "rejected"} successfully`,
      data: coupon,
    });
  } catch (error) {
    console.error("Error updating coupon status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update coupon status",
    });
  }
};

// Validate and apply coupon (Patient side)
const validateCoupon = async (req, res) => {
  try {
    const { code, doctorId } = req.body;
    const patientId = req.user.userId || req.user._id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
    }).populate("doctorId", "name email specialties");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    // Check if coupon belongs to the selected doctor
    if (doctorId && coupon.doctorId._id.toString() !== doctorId.toString()) {
      return res.status(400).json({
        success: false,
        message:
          "This coupon can only be used for appointments with Dr. " +
          coupon.doctorId.name,
      });
    }

    // Check if coupon is valid
    if (!coupon.isValid) {
      let reason = "Coupon is not valid";
      if (coupon.status !== "active") {
        reason = `Coupon is ${coupon.status}`;
      } else if (new Date() >= coupon.expiresAt) {
        reason = "Coupon has expired";
      } else if (coupon.usedBy) {
        reason = "Coupon has already been used";
      }

      return res.status(400).json({
        success: false,
        message: reason,
      });
    }

    res.json({
      success: true,
      message: "Coupon is valid!",
      data: {
        code: coupon.code,
        description: coupon.description,
        doctorId: coupon.doctorId._id,
        doctorName: coupon.doctorId.name,
        expiresAt: coupon.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
    });
  }
};

// Apply coupon to appointment (internal use during booking)
const applyCoupon = async (req, res) => {
  try {
    const { code, appointmentId } = req.body;
    const patientId = req.user.userId || req.user._id;

    console.log("🎫 Applying coupon:", {
      code,
      appointmentId,
      patientId,
    });

    // Find and validate coupon
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      status: "active",
    });

    console.log("🔍 Found coupon:", {
      found: !!coupon,
      isValid: coupon?.isValid,
      currentStatus: coupon?.status,
      alreadyUsedBy: coupon?.usedBy,
    });

    if (!coupon || !coupon.isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired coupon",
      });
    }

    // Mark coupon as used
    coupon.status = "used";
    coupon.usedBy = patientId;
    coupon.usedAt = new Date();
    coupon.appointmentId = appointmentId;

    console.log("💾 Saving coupon as used...");
    await coupon.save();
    console.log("✅ Coupon marked as used successfully");

    res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        code: coupon.code,
        discount: 100, // 100% discount (free)
      },
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply coupon",
    });
  }
};

// Get patient's coupon history
const getPatientCoupons = async (req, res) => {
  try {
    const patientId = req.user.userId || req.user._id;

    const coupons = await Coupon.find({ usedBy: patientId })
      .populate("doctorId", "name specialties")
      .populate("appointmentId", "date slot status")
      .sort({ usedAt: -1 });

    res.json({
      success: true,
      data: coupons,
      count: coupons.length,
    });
  } catch (error) {
    console.error("Error fetching patient coupons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupon history",
    });
  }
};

// Delete coupon (Doctor only, only if not used)
const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const doctorId = req.doctor?._id;

    const coupon = await Coupon.findOne({
      _id: couponId,
      doctorId: doctorId,
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found or access denied",
      });
    }

    // Don't allow deletion of used coupons
    if (coupon.status === "used") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete used coupons",
      });
    }

    await Coupon.findByIdAndDelete(couponId);

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
    });
  }
};

module.exports = {
  createCoupon,
  getDoctorCoupons,
  getAllCouponsForApproval,
  updateCouponStatus,
  validateCoupon,
  applyCoupon,
  getPatientCoupons,
  deleteCoupon,
};
