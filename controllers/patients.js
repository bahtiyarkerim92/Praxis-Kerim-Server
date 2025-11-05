const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const Patient = require("../models/Patient");
const { sendMarketingEmail } = require("../services/mailer");

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

// Validation rules for patient creation
const patientValidationRules = [
  body("name").trim().notEmpty().withMessage("Name ist erforderlich"),
  body("email").isEmail().normalizeEmail().withMessage("Gültige E-Mail erforderlich"),
  body("phone").trim().notEmpty().withMessage("Telefonnummer ist erforderlich"),
];

// GET /api/patients - Get all patients with search and filters (ADMIN only)
router.get(
  "/",
  authenticateToken,
  query("search").optional().trim(),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("skip").optional().isInt({ min: 0 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { search, limit = 50, skip = 0 } = req.query;
      const query = {};

      // Search functionality
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      const patients = await Patient.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Patient.countDocuments(query);

      return res.status(200).json({
        success: true,
        patients,
        total,
        count: patients.length,
      });
    } catch (error) {
      console.error("Error fetching patients:", error);
      return res.status(500).json({
        message: "Error fetching patients",
        error: error.message,
      });
    }
  }
);

// GET /api/patients/stats - Get patient statistics (ADMIN only)
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const total = await Patient.countDocuments();

    // Get recent patients (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentPatients = await Patient.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    return res.status(200).json({
      success: true,
      stats: {
        total,
        recentPatients,
      },
    });
  } catch (error) {
    console.error("Error fetching patient stats:", error);
    return res.status(500).json({
      message: "Error fetching patient statistics",
      error: error.message,
    });
  }
});

// GET /api/patients/:id - Get specific patient (ADMIN only)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    return res.status(200).json({
      success: true,
      patient,
    });
  } catch (error) {
    console.error("Error fetching patient:", error);
    return res.status(500).json({
      message: "Error fetching patient",
      error: error.message,
    });
  }
});

// POST /api/patients - Create new patient manually (ADMIN only)
router.post(
  "/",
  authenticateToken,
  patientValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, phone } = req.body;

      // Check if patient with this email already exists
      const existingPatient = await Patient.findOne({ email });

      if (existingPatient) {
        return res.status(409).json({
          message: "Ein Patient mit dieser E-Mail existiert bereits",
          patient: existingPatient,
        });
      }

      const patient = new Patient({
        name,
        email,
        phone,
      });

      await patient.save();

      return res.status(201).json({
        success: true,
        message: "Patient erfolgreich erstellt",
        patient,
      });
    } catch (error) {
      console.error("Error creating patient:", error);
      return res.status(500).json({
        message: "Error creating patient",
        error: error.message,
      });
    }
  }
);

// PATCH /api/patients/:id - Update patient (ADMIN only)
router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const allowedUpdates = ["name", "email", "phone"];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // If email is being updated, check for duplicates
    if (updates.email) {
      const existingPatient = await Patient.findOne({
        email: updates.email,
        _id: { $ne: req.params.id },
      });

      if (existingPatient) {
        return res.status(409).json({
          message: "Ein anderer Patient mit dieser E-Mail existiert bereits",
        });
      }
    }

    const patient = await Patient.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient aktualisiert",
      patient,
    });
  } catch (error) {
    console.error("Error updating patient:", error);
    return res.status(500).json({
      message: "Error updating patient",
      error: error.message,
    });
  }
});

// DELETE /api/patients/:id - Delete patient (ADMIN only)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient gelöscht",
    });
  } catch (error) {
    console.error("Error deleting patient:", error);
    return res.status(500).json({
      message: "Error deleting patient",
      error: error.message,
    });
  }
});

// POST /api/patients/send-bulk-email - Send marketing email to selected patients (ADMIN only)
router.post(
  "/send-bulk-email",
  authenticateToken,
  [
    body("patientIds").isArray().withMessage("Patient IDs must be an array"),
    body("sendToAll").optional().isBoolean().withMessage("sendToAll must be boolean"),
    body("subject").trim().notEmpty().withMessage("Subject is required"),
    body("content").trim().notEmpty().withMessage("Content is required"),
    body("locale").optional().isIn(["de", "en", "bg", "pl", "tr"]).withMessage("Invalid locale"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { patientIds, sendToAll, subject, content, locale = "de" } = req.body;

      let patients = [];

      if (sendToAll) {
        // Get all patients
        patients = await Patient.find({});
        console.log(`📧 Sending bulk email to all ${patients.length} patients`);
      } else if (patientIds && patientIds.length > 0) {
        // Get selected patients
        patients = await Patient.find({ _id: { $in: patientIds } });
        console.log(`📧 Sending bulk email to ${patients.length} selected patients`);
      } else {
        return res.status(400).json({
          message: "No patients selected or sendToAll not specified",
        });
      }

      if (patients.length === 0) {
        return res.status(400).json({
          message: "No patients found",
        });
      }

      // Send emails in parallel with error handling
      const results = await Promise.allSettled(
        patients.map((patient) =>
          sendMarketingEmail(
            patient.email,
            patient.name,
            subject,
            content,
            locale
          )
        )
      );

      // Count successes and failures
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(`✅ Bulk email complete: ${successful} sent, ${failed} failed`);

      return res.status(200).json({
        success: true,
        message: `E-Mails gesendet: ${successful} erfolgreich, ${failed} fehlgeschlagen`,
        stats: {
          total: patients.length,
          successful,
          failed,
        },
      });
    } catch (error) {
      console.error("Error sending bulk email:", error);
      return res.status(500).json({
        message: "Error sending bulk emails",
        error: error.message,
      });
    }
  }
);

module.exports = router;

