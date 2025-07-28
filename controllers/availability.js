const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const {
  authenticateDoctorToken,
  optionalDoctorAuth,
} = require("../middleware/doctorAuth");
const { authenticateToken } = require("../middleware/auth");
const Availability = require("../models/Availability");
const Doctor = require("../models/Doctor");

const router = express.Router();

// --- Helper Functions ---

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

const requireAdmin = (req, res, next) => {
  if (!req.doctor || !req.doctor.isAdmin) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }
  next();
};

// --- Validation Rules ---

const availabilityValidationRules = [
  body("date")
    .isISO8601()
    .withMessage("Valid date is required")
    .custom((value) => {
      // Parse the incoming date as UTC
      const appointmentDate = new Date(value + "T00:00:00.000Z");
      const todayUTC = new Date();
      // Set to start of day in UTC
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
];

// --- Routes ---

// GET /api/availability/doctor - Get doctor's own availability (authenticated, no filtering)
router.get("/doctor", authenticateDoctorToken, async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const filter = { doctorId: req.doctor._id };

    if (date) {
      // Parse date as UTC to avoid timezone shifts
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
    // No default date filtering for doctors - they should see all their availability

    const availability = await Availability.find(filter)
      .populate("doctorId", "name email specialties")
      .sort({ date: 1 });

    res.json({
      success: true,
      data: availability,
      count: availability.length,
    });
  } catch (error) {
    console.error("Error fetching doctor availability:", error);
    res.status(500).json({
      message: "Error fetching availability",
      error: error.message,
    });
  }
});

// GET /api/availability - Get availability (public endpoint for patients)
router.get("/", async (req, res) => {
  try {
    const { doctorId, date, startDate, endDate } = req.query;
    const filter = { isActive: true };

    if (doctorId) {
      filter.doctorId = doctorId;
    }

    if (date) {
      // Parse date as UTC to avoid timezone shifts (same as doctor endpoint)
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
    } else {
      // Only return future dates if no specific date range is provided
      // Allow same-day bookings up to current time
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0); // Start of today in UTC
      filter.date = {
        $gte: todayUTC,
      };
    }

    const availability = await Availability.find(filter)
      .populate("doctorId", "name email specialties")
      .sort({ date: 1 });

    // Transform the data to match client expectations, filtering out invalid entries
    const transformedData = availability
      .filter((avail) => avail.doctorId) // Only include entries with valid doctor references
      .map((avail) => {
        let availableSlots = avail.slots;

        // For today's appointments, filter out slots that have already passed (UTC-based)
        const availDateUTC = avail.date.toISOString().split("T")[0];
        const todayUTC = new Date().toISOString().split("T")[0];

        if (availDateUTC === todayUTC) {
          // Production time filtering: Remove past slots with 30-minute buffer
          const nowUTC = new Date();
          availableSlots = avail.slots.filter((slot) => {
            const [slotHour, slotMinute] = slot.split(":").map(Number);

            // Create slot time in UTC
            const slotTimeUTC = new Date(avail.date);
            slotTimeUTC.setUTCHours(slotHour, slotMinute, 0, 0);

            // Add 30-minute buffer
            const bufferTimeUTC = new Date(nowUTC.getTime() + 30 * 60 * 1000);

            return slotTimeUTC >= bufferTimeUTC;
          });
        }

        return {
          date: availDateUTC, // YYYY-MM-DD format
          slots: availableSlots,
          doctorId: avail.doctorId._id,
          doctorName: avail.doctorId.name,
        };
      })
      .filter((avail) => avail.slots.length > 0); // Only include availability with available slots

    res.json({
      success: true,
      data: transformedData,
      count: transformedData.length,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({
      message: "Error fetching availability",
      error: error.message,
    });
  }
});

// GET /api/availability/:id - Get single availability
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid availability ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const availability = await Availability.findById(req.params.id).populate(
        "doctorId",
        "name email specialties"
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

// POST /api/availability - Create availability (doctors only)
router.post(
  "/",
  authenticateDoctorToken,
  availabilityValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { date, slots } = req.body;

      // Check if availability already exists for this doctor and date
      const appointmentDateUTC = new Date(date + "T00:00:00.000Z");
      const existingAvailability = await Availability.findOne({
        doctorId: req.doctor._id,
        date: appointmentDateUTC,
      });

      if (existingAvailability) {
        return res.status(409).json({
          message: "Availability for this date already exists",
          existingData: existingAvailability,
        });
      }

      // Remove duplicate slots and sort them
      const uniqueSlots = [...new Set(slots)].sort();

      const availability = new Availability({
        doctorId: req.doctor._id,
        date: appointmentDateUTC,
        slots: uniqueSlots,
      });

      await availability.save();
      await availability.populate("doctorId", "name email specialties");

      res.status(201).json({
        success: true,
        message: "Availability created successfully",
        data: availability,
      });
    } catch (error) {
      console.error("Error creating availability:", error);
      res.status(500).json({
        message: "Error creating availability",
        error: error.message,
      });
    }
  }
);

// PUT /api/availability/:id - Update availability (doctors can only edit their own)
router.put(
  "/:id",
  authenticateDoctorToken,
  [
    param("id").isMongoId().withMessage("Invalid availability ID"),
    body("slots")
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one time slot is required"),
    body("slots.*")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Each slot must be in HH:MM format"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { slots, isActive } = req.body;

      const availability = await Availability.findById(req.params.id);
      if (!availability) {
        return res.status(404).json({
          message: "Availability not found",
        });
      }

      // Check if doctor owns this availability
      if (
        !req.doctor.isAdmin &&
        availability.doctorId.toString() !== req.doctor._id.toString()
      ) {
        return res.status(403).json({
          message: "You can only edit your own availability",
        });
      }

      const updateData = {};

      if (slots) {
        // Remove duplicate slots and sort them
        updateData.slots = [...new Set(slots)].sort();
      }

      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }

      updateData.updatedAt = Date.now();

      const updatedAvailability = await Availability.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate("doctorId", "name email specialties");

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

// DELETE /api/availability/:id - Delete availability (doctors can only delete their own)
router.delete(
  "/:id",
  authenticateDoctorToken,
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

      // Check if doctor owns this availability
      if (
        !req.doctor.isAdmin &&
        availability.doctorId.toString() !== req.doctor._id.toString()
      ) {
        return res.status(403).json({
          message: "You can only delete your own availability",
        });
      }

      await Availability.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Availability deleted successfully",
        data: availability,
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

// POST /api/availability/:id/add-slot - Add time slot to existing availability
router.post(
  "/:id/add-slot",
  authenticateDoctorToken,
  requireAdmin,
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
        return res.status(409).json({
          message: "Time slot already exists",
        });
      }

      availability.slots.push(slot);
      availability.slots.sort();
      availability.updatedAt = Date.now();

      await availability.save();
      await availability.populate("doctorId", "name email specialties");

      res.json({
        success: true,
        message: "Time slot added successfully",
        data: availability,
      });
    } catch (error) {
      console.error("Error adding time slot:", error);
      res.status(500).json({
        message: "Error adding time slot",
        error: error.message,
      });
    }
  }
);

// DELETE /api/availability/:id/remove-slot - Remove time slot from availability
router.delete(
  "/:id/remove-slot",
  authenticateDoctorToken,
  requireAdmin,
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
        return res.status(404).json({
          message: "Time slot not found",
        });
      }

      availability.slots.splice(slotIndex, 1);
      availability.updatedAt = Date.now();

      await availability.save();
      await availability.populate("doctorId", "name email specialties");

      res.json({
        success: true,
        message: "Time slot removed successfully",
        data: availability,
      });
    } catch (error) {
      console.error("Error removing time slot:", error);
      res.status(500).json({
        message: "Error removing time slot",
        error: error.message,
      });
    }
  }
);

module.exports = router;
