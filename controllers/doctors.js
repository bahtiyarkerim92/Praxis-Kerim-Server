const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const {
  authenticateDoctorToken,
  requireDoctorAdmin,
  optionalDoctorAuth,
} = require("../middleware/doctorAuth");
const Doctor = require("../models/Doctor");
const bcrypt = require("bcrypt");

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
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }
  next();
};

// --- Validation Rules ---

const doctorValidationRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password")
    .optional()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("specialties")
    .isArray({ min: 1 })
    .withMessage("At least one specialty is required"),
  body("specialties.*")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Each specialty must be between 2 and 50 characters"),

  body("bio")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Bio must not exceed 1000 characters"),
  body("photoUrl").optional().trim(),
  body("experience")
    .optional()
    .isInt({ min: 0, max: 60 })
    .withMessage("Experience must be between 0 and 60 years"),
  body("isAdmin")
    .optional()
    .isBoolean()
    .withMessage("isAdmin must be a boolean"),
  body("isDoctor")
    .optional()
    .isBoolean()
    .withMessage("isDoctor must be a boolean"),
  body("countriesOfOperation")
    .optional()
    .isArray()
    .withMessage("Countries of operation must be an array"),
  body("countriesOfOperation.*")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Each country must be between 2 and 100 characters"),
  body("languages")
    .optional()
    .isArray()
    .withMessage("Languages must be an array"),
  body("languages.*")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Each language must be between 2 and 50 characters"),
];

const updateDoctorValidationRules = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("specialties")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one specialty is required"),
  body("specialties.*")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Each specialty must be between 2 and 50 characters"),

  body("bio")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Bio must not exceed 1000 characters"),
  body("experience")
    .optional()
    .isInt({ min: 0, max: 60 })
    .withMessage("Experience must be between 0 and 60 years"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("isAdmin")
    .optional()
    .isBoolean()
    .withMessage("isAdmin must be a boolean"),
  body("isDoctor")
    .optional()
    .isBoolean()
    .withMessage("isDoctor must be a boolean"),
  body("countriesOfOperation")
    .optional()
    .isArray()
    .withMessage("Countries of operation must be an array"),
  body("countriesOfOperation.*")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Each country must be between 2 and 100 characters"),
  body("languages")
    .optional()
    .isArray()
    .withMessage("Languages must be an array"),
  body("languages.*")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Each language must be between 2 and 50 characters"),
];

// --- Routes ---

// GET /api/doctors - Get all doctors (can be accessed by authenticated doctors or users)
router.get("/", optionalDoctorAuth, async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};

    // Filter by active status if provided
    if (active !== undefined) {
      filter.isActive = active === "true";
    } else {
      // By default, only return active doctors for public API
      filter.isActive = true;
    }

    // For doctor dashboard: show all users (doctors and admins)
    // For patient side: only show doctors
    if (req.user && (req.user.isDoctor || req.user.isAdmin)) {
      // Doctor dashboard - show all users
      filter.$or = [{ isDoctor: true }, { isAdmin: true }];
    } else {
      // Patient side - only show doctors
      filter.isDoctor = true;
    }
    const doctors = await Doctor.find(filter)
      .select("-password -refreshTokens")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: doctors,
      count: doctors.length,
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({
      message: "Error fetching doctors",
      error: error.message,
    });
  }
});

// GET /api/doctors/:id - Get single doctor
router.get(
  "/:id",
  optionalDoctorAuth,
  [param("id").isMongoId().withMessage("Invalid doctor ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const doctor = await Doctor.findById(req.params.id).select(
        "-password -refreshTokens"
      );

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      res.json({
        success: true,
        data: doctor,
      });
    } catch (error) {
      console.error("Error fetching doctor:", error);
      res.status(500).json({
        message: "Error fetching doctor",
        error: error.message,
      });
    }
  }
);

// POST /api/doctors - Create new doctor (admin only)
router.post(
  "/",
  authenticateDoctorToken,
  requireDoctorAdmin,
  doctorValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        name,
        email,
        password = "TempPassword123!",
        specialties,
        bio,
        photoUrl,
        experience,
        isAdmin = false,
        isDoctor = true,
        countriesOfOperation = [],
        languages = [],
      } = req.body;

      // Check if doctor with this email already exists
      const existingDoctor = await Doctor.findOne({ email });
      if (existingDoctor) {
        return res.status(409).json({
          message: "Doctor with this email already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      const doctor = new Doctor({
        name,
        email,
        password: hashedPassword,
        specialties,
        bio,
        photoUrl,
        experience,
        isAdmin,
        isDoctor,
        countriesOfOperation,
        languages,
      });

      await doctor.save();

      // Remove password from response
      const doctorResponse = doctor.toObject();
      delete doctorResponse.password;
      delete doctorResponse.refreshTokens;

      res.status(201).json({
        success: true,
        message: "Doctor created successfully",
        data: doctorResponse,
      });
    } catch (error) {
      console.error("Error creating doctor:", error);
      res.status(500).json({
        message: "Error creating doctor",
        error: error.message,
      });
    }
  }
);

// PUT /api/doctors/profile - Update own profile (any authenticated doctor)
router.put(
  "/profile",
  authenticateDoctorToken,
  [
    body("name")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Name must be at least 2 characters"),
    body("bio")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Bio must not exceed 1000 characters"),
    body("photoUrl")
      .optional()
      .isString()
      .withMessage("Photo URL must be a string"),
    body("experience")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Experience must be a positive number"),
    body("specialties")
      .optional()
      .isArray()
      .withMessage("Specialties must be an array"),
    body("countriesOfOperation")
      .optional()
      .isArray()
      .withMessage("Countries of operation must be an array"),
    body("languages")
      .optional()
      .isArray()
      .withMessage("Languages must be an array"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, bio, photoUrl, experience, specialties, countriesOfOperation, languages } = req.body;

      // Validate and clean data
      const cleanSpecialties = specialties
        ? specialties.filter((s) => s && s.trim())
        : undefined;
      
      const cleanCountries = countriesOfOperation
        ? countriesOfOperation.filter((c) => c && c.trim())
        : undefined;
        
      const cleanLanguages = languages
        ? languages.filter((l) => l && l.trim())
        : undefined;

      const updateData = {
        ...(name && { name }),
        ...(bio !== undefined && { bio }), // Allow empty string
        ...(photoUrl !== undefined && { photoUrl }), // Allow empty string
        ...(experience !== undefined && { experience }),
        ...(cleanSpecialties &&
          cleanSpecialties.length > 0 && { specialties: cleanSpecialties }),
        ...(cleanCountries &&
          cleanCountries.length > 0 && { countriesOfOperation: cleanCountries }),
        ...(cleanLanguages &&
          cleanLanguages.length > 0 && { languages: cleanLanguages }),
        updatedAt: Date.now(),
      };

      const doctor = await Doctor.findByIdAndUpdate(
        req.doctor._id,
        updateData,
        { new: true, runValidators: true }
      ).select("-password -refreshTokens");

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: doctor,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({
        message: "Error updating profile",
        error: error.message,
      });
    }
  }
);

// PUT /api/doctors/:id - Update doctor (admin only)
router.put(
  "/:id",
  authenticateDoctorToken,
  requireDoctorAdmin,
  [param("id").isMongoId().withMessage("Invalid doctor ID")],
  updateDoctorValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, ...otherUpdates } = req.body;

      // Debug logging
      console.log("Update doctor request:", {
        doctorId: req.params.id,
        email: email,
        updateData: Object.keys(otherUpdates),
      });

      // Validate doctor ID format
      const mongoose = require("mongoose");
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          message: "Invalid doctor ID format",
        });
      }

      // Check if another doctor has this email
      if (email) {
        const existingDoctor = await Doctor.findOne({
          email,
          _id: { $ne: req.params.id },
        });

        console.log("Email check result:", {
          email,
          existingDoctor: existingDoctor ? existingDoctor._id : null,
          currentDoctorId: req.params.id,
        });

        if (existingDoctor) {
          return res.status(409).json({
            message: "Another doctor with this email already exists",
          });
        }
      }

      const updateData = { ...otherUpdates, updatedAt: Date.now() };

      // Only update email if provided
      if (email) {
        updateData.email = email;
      }

      // Hash password if provided
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const doctor = await Doctor.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      }).select("-password -refreshTokens");

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      res.json({
        success: true,
        message: "Doctor updated successfully",
        data: doctor,
      });
    } catch (error) {
      console.error("Error updating doctor:", error);
      res.status(500).json({
        message: "Error updating doctor",
        error: error.message,
      });
    }
  }
);

// DELETE /api/doctors/:id - Delete doctor (admin only)
router.delete(
  "/:id",
  authenticateDoctorToken,
  requireDoctorAdmin,
  [param("id").isMongoId().withMessage("Invalid doctor ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const doctor = await Doctor.findByIdAndDelete(req.params.id);

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      res.json({
        success: true,
        message: "Doctor deleted successfully",
        data: doctor,
      });
    } catch (error) {
      console.error("Error deleting doctor:", error);
      res.status(500).json({
        message: "Error deleting doctor",
        error: error.message,
      });
    }
  }
);

module.exports = router;
