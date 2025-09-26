const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const { authenticateToken } = require("../../middleware/auth");
const { authenticateDoctorToken } = require("../../middleware/doctorAuth");
const {
  createCoupon,
  getDoctorCoupons,
  getAllCouponsForApproval,
  updateCouponStatus,
  validateCoupon,
  applyCoupon,
  getPatientCoupons,
  deleteCoupon,
} = require("../../controllers/coupons");

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require("express-validator");
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// --- Doctor Routes (require doctor authentication) ---

// Create coupon (POST /api/coupons/create)
router.post(
  "/create",
  authenticateDoctorToken,
  [
    body("description")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Description must not exceed 200 characters"),
    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("Invalid expiration date format"),
  ],
  handleValidationErrors,
  createCoupon
);

// Get doctor's coupons (GET /api/coupons/my-coupons)
router.get("/my-coupons", authenticateDoctorToken, getDoctorCoupons);

// Delete coupon (DELETE /api/coupons/:couponId)
router.delete(
  "/:couponId",
  authenticateDoctorToken,
  [param("couponId").isMongoId().withMessage("Invalid coupon ID")],
  handleValidationErrors,
  deleteCoupon
);

// --- Admin Routes (require admin doctor authentication) ---

// Get all coupons for approval (GET /api/coupons/admin/all)
router.get("/admin/all", authenticateDoctorToken, getAllCouponsForApproval);

// Approve/Reject coupon (PUT /api/coupons/admin/:couponId/status)
router.put(
  "/admin/:couponId/status",
  authenticateDoctorToken,
  [
    param("couponId").isMongoId().withMessage("Invalid coupon ID"),
    body("status")
      .isIn(["active", "rejected"])
      .withMessage("Status must be 'active' or 'rejected'"),
    body("rejectionReason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Rejection reason must not exceed 500 characters"),
  ],
  handleValidationErrors,
  updateCouponStatus
);

// --- Patient Routes (require patient authentication) ---

// Validate coupon (POST /api/coupons/validate)
router.post(
  "/validate",
  authenticateToken,
  [
    body("code")
      .notEmpty()
      .trim()
      .toUpperCase()
      .matches(/^TELE\d{6}$/)
      .withMessage("Invalid coupon code format"),
  ],
  handleValidationErrors,
  validateCoupon
);

// Apply coupon to appointment (POST /api/coupons/apply)
router.post(
  "/apply",
  authenticateToken,
  [
    body("code")
      .notEmpty()
      .trim()
      .toUpperCase()
      .matches(/^TELE\d{6}$/)
      .withMessage("Invalid coupon code format"),
    body("appointmentId").isMongoId().withMessage("Invalid appointment ID"),
  ],
  handleValidationErrors,
  applyCoupon
);

// Get patient's coupon history (GET /api/coupons/my-history)
router.get("/my-history", authenticateToken, getPatientCoupons);

module.exports = router;
