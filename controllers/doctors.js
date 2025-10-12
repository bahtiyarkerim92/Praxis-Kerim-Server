const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const Doctor = require("../models/Doctor");

const router = express.Router();

// Helper function
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// Validation rules
const doctorValidationRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("priority")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Priority must be a positive integer"),
];

// GET /api/doctors - Get all doctors (PUBLIC - no auth required)
router.get("/", async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({ priority: 1, name: 1 });

    return res.status(200).json({
      success: true,
      doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    return res.status(500).json({
      message: "Error fetching doctors",
      error: error.message,
    });
  }
});

// GET /api/doctors/:id - Get doctor by ID
router.get(
  "/:id",
  authenticateToken,
  param("id").isMongoId().withMessage("Valid doctor ID is required"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const doctor = await Doctor.findById(req.params.id);

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      return res.status(200).json({
        success: true,
        doctor,
      });
    } catch (error) {
      console.error("Error fetching doctor:", error);
      return res.status(500).json({
        message: "Error fetching doctor",
        error: error.message,
      });
    }
  }
);

// POST /api/doctors - Create doctor
router.post(
  "/",
  authenticateToken,
  doctorValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, priority } = req.body;

      const doctor = new Doctor({ name, priority });
      await doctor.save();

      return res.status(201).json({
        success: true,
        message: "Doctor created successfully",
        doctor,
      });
    } catch (error) {
      console.error("Error creating doctor:", error);
      return res.status(500).json({
        message: "Error creating doctor",
        error: error.message,
      });
    }
  }
);

// PATCH /api/doctors/:id - Update doctor
router.patch(
  "/:id",
  authenticateToken,
  param("id").isMongoId().withMessage("Valid doctor ID is required"),
  doctorValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, priority } = req.body;

      const updateData = { name };
      if (priority !== undefined) {
        updateData.priority = priority;
      }

      const doctor = await Doctor.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Doctor updated successfully",
        doctor,
      });
    } catch (error) {
      console.error("Error updating doctor:", error);
      return res.status(500).json({
        message: "Error updating doctor",
        error: error.message,
      });
    }
  }
);

// DELETE /api/doctors/:id - Delete doctor
router.delete(
  "/:id",
  authenticateToken,
  param("id").isMongoId().withMessage("Valid doctor ID is required"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const doctor = await Doctor.findByIdAndDelete(req.params.id);

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Doctor deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting doctor:", error);
      return res.status(500).json({
        message: "Error deleting doctor",
        error: error.message,
      });
    }
  }
);

module.exports = router;
