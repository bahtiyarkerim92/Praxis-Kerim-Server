const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const Availability = require("../models/Availability");
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
const availabilityValidationRules = [
  body("date")
    .isISO8601()
    .withMessage("Valid date is required")
    .custom((value) => {
      const appointmentDate = new Date(value + "T00:00:00.000Z");
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);

      if (appointmentDate < todayUTC) {
        throw new Error("Date cannot be in the past");
      }
      return true;
    }),
  body("slots")
    .isArray({ min: 1 })
    .withMessage("At least one time slot is required"),
  body("slots.*")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Each slot must be in HH:MM format"),
  body("doctorId").isMongoId().withMessage("Valid doctor ID is required"),
];

// GET /api/availability - Get all availability
router.get("/", async (req, res) => {
  try {
    const { doctorId, date, startDate, endDate } = req.query;
    const filter = {};

    if (doctorId) {
      filter.doctorId = doctorId;
    }

    if (date) {
      const targetDateUTC = new Date(date + "T00:00:00.000Z");
      const nextDayUTC = new Date(targetDateUTC);
      nextDayUTC.setUTCDate(nextDayUTC.getUTCDate() + 1);

      filter.date = {
        $gte: targetDateUTC,
        $lt: nextDayUTC,
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate + "T00:00:00.000Z"),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    const availability = await Availability.find(filter)
      .populate("doctorId", "name")
      .sort({ date: 1 });

    res.json({
      success: true,
      data: availability,
      count: availability.length,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({
      message: "Error fetching availability",
      error: error.message,
    });
  }
});

// GET /api/availability/:id - Get specific availability
router.get(
  "/:id",
  param("id").isMongoId().withMessage("Invalid availability ID"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const availability = await Availability.findById(req.params.id).populate(
        "doctorId",
        "name"
      );

      if (!availability) {
        return res.status(404).json({
          message: "Availability not found",
        });
      }

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({
        message: "Error fetching availability",
        error: error.message,
      });
    }
  }
);

// POST /api/availability - Create availability
router.post(
  "/",
  authenticateToken,
  availabilityValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { doctorId, date, slots } = req.body;

      // Verify doctor exists
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      const appointmentDateUTC = new Date(date + "T00:00:00.000Z");

      // Check if availability already exists for this doctor on this date
      const existingAvailability = await Availability.findOne({
        doctorId,
        date: appointmentDateUTC,
      });

      if (existingAvailability) {
        return res.status(409).json({
          message: "Availability already exists for this date",
          suggestion: "Use PUT to update existing availability",
        });
      }

      // Remove duplicates and sort slots
      const uniqueSlots = [...new Set(slots)].sort();

      const availability = new Availability({
        doctorId,
        date: appointmentDateUTC,
        slots: uniqueSlots,
      });

      await availability.save();

      const populatedAvailability = await Availability.findById(
        availability._id
      ).populate("doctorId", "name");

      res.status(201).json({
        success: true,
        message: "Availability created successfully",
        data: populatedAvailability,
      });
    } catch (error) {
      console.error("Error creating availability:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "Availability already exists for this date",
        });
      }

      res.status(500).json({
        message: "Error creating availability",
        error: error.message,
      });
    }
  }
);

// PUT /api/availability/:id - Update availability
router.put(
  "/:id",
  authenticateToken,
  [
    param("id").isMongoId().withMessage("Invalid availability ID"),
    body("slots")
      .isArray({ min: 1 })
      .withMessage("At least one time slot is required"),
    body("slots.*")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Each slot must be in HH:MM format"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { slots } = req.body;

      const availability = await Availability.findById(req.params.id);

      if (!availability) {
        return res.status(404).json({
          message: "Availability not found",
        });
      }

      // Remove duplicates and sort slots
      const uniqueSlots = [...new Set(slots)].sort();
      availability.slots = uniqueSlots;

      await availability.save();

      const updatedAvailability = await Availability.findById(
        availability._id
      ).populate("doctorId", "name");

      res.json({
        success: true,
        message: "Availability updated successfully",
        data: updatedAvailability,
      });
    } catch (error) {
      console.error("Error updating availability:", error);
      res.status(500).json({
        message: "Error updating availability",
        error: error.message,
      });
    }
  }
);

// DELETE /api/availability/:id - Delete availability
router.delete(
  "/:id",
  authenticateToken,
  [param("id").isMongoId().withMessage("Invalid availability ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const availability = await Availability.findById(req.params.id);

      if (!availability) {
        return res.status(404).json({
          message: "Availability not found",
        });
      }

      await Availability.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Availability deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting availability:", error);
      res.status(500).json({
        message: "Error deleting availability",
        error: error.message,
      });
    }
  }
);

// POST /api/availability/:id/add-slot - Add slot to existing availability
router.post(
  "/:id/add-slot",
  authenticateToken,
  [
    param("id").isMongoId().withMessage("Invalid availability ID"),
    body("slot")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Slot must be in HH:MM format"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { slot } = req.body;

      const availability = await Availability.findById(req.params.id);

      if (!availability) {
        return res.status(404).json({
          message: "Availability not found",
        });
      }

      if (availability.slots.includes(slot)) {
        return res.status(400).json({
          message: "Slot already exists",
        });
      }

      availability.slots.push(slot);
      availability.slots.sort();
      await availability.save();

      const updatedAvailability = await Availability.findById(
        availability._id
      ).populate("doctorId", "name");

      res.json({
        success: true,
        message: "Slot added successfully",
        data: updatedAvailability,
      });
    } catch (error) {
      console.error("Error adding slot:", error);
      res.status(500).json({
        message: "Error adding slot",
        error: error.message,
      });
    }
  }
);

// DELETE /api/availability/:id/remove-slot - Remove slot from availability
router.delete(
  "/:id/remove-slot",
  authenticateToken,
  [
    param("id").isMongoId().withMessage("Invalid availability ID"),
    body("slot")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Slot must be in HH:MM format"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { slot } = req.body;

      const availability = await Availability.findById(req.params.id);

      if (!availability) {
        return res.status(404).json({
          message: "Availability not found",
        });
      }

      const slotIndex = availability.slots.indexOf(slot);

      if (slotIndex === -1) {
        return res.status(400).json({
          message: "Slot not found",
        });
      }

      availability.slots.splice(slotIndex, 1);
      await availability.save();

      const updatedAvailability = await Availability.findById(
        availability._id
      ).populate("doctorId", "name");

      res.json({
        success: true,
        message: "Slot removed successfully",
        data: updatedAvailability,
      });
    } catch (error) {
      console.error("Error removing slot:", error);
      res.status(500).json({
        message: "Error removing slot",
        error: error.message,
      });
    }
  }
);

// POST /api/availability/copy - Copy schedule from one doctor to another
router.post(
  "/copy",
  authenticateToken,
  [
    body("fromDoctorId")
      .notEmpty()
      .withMessage("Source doctor ID is required")
      .isMongoId()
      .withMessage("Valid source doctor ID is required"),
    body("toDoctorId")
      .notEmpty()
      .withMessage("Target doctor ID is required")
      .isMongoId()
      .withMessage("Valid target doctor ID is required"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Valid start date is required"),
    body("endDate")
      .optional()
      .isISO8601()
      .withMessage("Valid end date is required"),
    body("overwrite")
      .optional()
      .isBoolean()
      .withMessage("Overwrite must be boolean"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        fromDoctorId,
        toDoctorId,
        startDate,
        endDate,
        overwrite = false,
      } = req.body;

      // Build query for source doctor's availability
      const query = { doctorId: fromDoctorId };
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      // Find source doctor's availabilities
      const sourceAvailabilities = await Availability.find(query).lean();

      if (sourceAvailabilities.length === 0) {
        return res.status(404).json({
          message:
            "No availabilities found for source doctor in the specified date range",
        });
      }

      // Check if target doctor already has availabilities for these dates
      if (!overwrite) {
        const targetDates = sourceAvailabilities.map((a) => a.date);
        const existingTargetAvail = await Availability.find({
          doctorId: toDoctorId,
          date: { $in: targetDates },
        });

        if (existingTargetAvail.length > 0) {
          return res.status(409).json({
            message: `Target doctor already has ${existingTargetAvail.length} availabilities for these dates. Set overwrite=true to replace them.`,
            conflictingDates: existingTargetAvail.map((a) => a.date),
          });
        }
      }

      // If overwrite is true, delete existing availabilities for target doctor
      if (overwrite) {
        const targetDates = sourceAvailabilities.map((a) => a.date);
        await Availability.deleteMany({
          doctorId: toDoctorId,
          date: { $in: targetDates },
        });
      }

      // Copy availabilities to target doctor
      const newAvailabilities = sourceAvailabilities.map((avail) => ({
        doctorId: toDoctorId,
        date: avail.date,
        slots: avail.slots,
        isActive: avail.isActive,
      }));

      const created = await Availability.insertMany(newAvailabilities);

      res.status(201).json({
        message: `Successfully copied ${created.length} availabilities from source to target doctor`,
        count: created.length,
        data: created,
      });
    } catch (error) {
      console.error("Error copying schedule:", error);
      res.status(500).json({
        message: "Error copying schedule",
        error: error.message,
      });
    }
  }
);

module.exports = router;
