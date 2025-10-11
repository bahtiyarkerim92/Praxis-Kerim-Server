const express = require("express");
const { body, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const Holiday = require("../models/Holiday");

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
const holidayValidationRules = [
  body("date").isISO8601().withMessage("Valid date is required"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Holiday name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
];

// GET /api/holidays - Get all holidays (PUBLIC)
router.get("/", async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = {};

    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      filter.date = { $gte: startDate, $lte: endDate };
    } else if (month && year) {
      const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 });

    // Transform to include formatted date string
    const formattedHolidays = holidays.map((h) => ({
      _id: h._id,
      date: h.date.toISOString().split("T")[0],
      name: h.name,
      description: h.description,
      createdAt: h.createdAt,
    }));

    return res.status(200).json(formattedHolidays);
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return res.status(500).json({
      message: "Error fetching holidays",
      error: error.message,
    });
  }
});

// POST /api/holidays - Create holiday (ADMIN only)
router.post(
  "/",
  authenticateToken,
  holidayValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { date, name, description } = req.body;

      // Convert date to UTC midnight
      const holidayDate = new Date(date + "T00:00:00.000Z");

      const holiday = new Holiday({
        date: holidayDate,
        name,
        description,
      });

      await holiday.save();

      return res.status(201).json({
        success: true,
        message: "Holiday created successfully",
        holiday: {
          _id: holiday._id,
          date: holiday.date.toISOString().split("T")[0],
          name: holiday.name,
          description: holiday.description,
        },
      });
    } catch (error) {
      console.error("Error creating holiday:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "Holiday already exists for this date",
        });
      }

      return res.status(500).json({
        message: "Error creating holiday",
        error: error.message,
      });
    }
  }
);

// DELETE /api/holidays/:id - Delete holiday (ADMIN only)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const holiday = await Holiday.findByIdAndDelete(id);

    if (!holiday) {
      return res.status(404).json({
        message: "Holiday not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Holiday deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    return res.status(500).json({
      message: "Error deleting holiday",
      error: error.message,
    });
  }
});

module.exports = router;
