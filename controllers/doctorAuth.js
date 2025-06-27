require("dotenv").config();
const doctorAuthController = require("express").Router();
const Doctor = require("../models/Doctor");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require("../services/cookie/cookieService");
const {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} = require("../services/token/tokenService");

// Helper function to handle validation errors
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

// Validation rules for doctor registration
const doctorRegisterValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("specialties")
    .isArray({ min: 1 })
    .withMessage("At least one specialty is required"),
  body("plansOffered")
    .isArray({ min: 1 })
    .withMessage("At least one plan is required"),
  body("plansOffered.*")
    .isIn(["basic", "standard", "premium", "consultation", "follow-up"])
    .withMessage("Invalid plan type"),
  body("bio").optional().trim(),
  body("photoUrl").optional().trim(),
  body("isAdmin").optional().isBoolean(),
];

// Validation rules for doctor login
const doctorLoginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Generate doctor JWT tokens
const generateDoctorAccessToken = (doctor) => {
  return jwt.sign(
    {
      userId: doctor._id,
      email: doctor.email,
      isAdmin: doctor.isAdmin,
      userType: "doctor",
    },
    process.env.DOCTOR_JWT_SECRET || process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
};

const generateDoctorRefreshToken = (doctor) => {
  const jti = require("crypto").randomBytes(16).toString("hex");
  const token = jwt.sign(
    {
      userId: doctor._id,
      jti,
      userType: "doctor",
    },
    process.env.DOCTOR_JWT_SECRET || process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  return { token, jti };
};

// Store refresh token for doctor
const storeDoctorRefreshToken = async (doctor, token, jti) => {
  doctor.refreshTokens.push({
    token,
    jti,
    createdAt: new Date(),
    invalidated: false,
  });
  await doctor.save();
};

// POST /api/doctor-auth/register - Register new doctor (admin only)
doctorAuthController.post(
  "/register",
  doctorRegisterValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        specialties,
        plansOffered,
        bio = "",
        photoUrl = "",
        isAdmin = false,
      } = req.body;

      // Check for existing doctor
      const existingDoctor = await Doctor.findOne({
        email: email.toLowerCase(),
      });
      if (existingDoctor) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new doctor
      const doctor = new Doctor({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        specialties,
        plansOffered,
        bio,
        photoUrl,
        isAdmin,
      });

      await doctor.save();

      // Remove password from response
      const doctorResponse = doctor.toObject();
      delete doctorResponse.password;
      delete doctorResponse.refreshTokens;

      res.status(201).json({
        message: "Doctor registered successfully",
        doctor: doctorResponse,
      });
    } catch (error) {
      console.error("Doctor registration error:", error);
      if (error.code === 11000) {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(500).json({ message: "Error during registration" });
    }
  }
);

// POST /api/doctor-auth/login - Doctor login
doctorAuthController.post(
  "/login",
  doctorLoginValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find doctor by email
      const doctor = await Doctor.findOne({ email: email.toLowerCase() });
      if (!doctor) {
        return res.status(400).json({
          message: "Email or password is incorrect",
        });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, doctor.password);
      if (!validPassword) {
        return res.status(400).json({
          message: "Email or password is incorrect",
        });
      }

      // Check if doctor is active
      if (!doctor.isActive) {
        return res.status(403).json({
          message: "Your account has been deactivated. Please contact support.",
        });
      }

      // Generate tokens
      const accessToken = generateDoctorAccessToken(doctor);
      const { token: refreshToken, jti } = generateDoctorRefreshToken(doctor);

      // Store refresh token
      await storeDoctorRefreshToken(doctor, refreshToken, jti);

      // Set refresh token cookie
      setRefreshTokenCookie(res, refreshToken, req);

      // Remove sensitive data from response
      const doctorResponse = doctor.toObject();
      delete doctorResponse.password;
      delete doctorResponse.refreshTokens;

      res.status(200).json({
        message: "Login successful",
        doctor: doctorResponse,
        accessToken,
      });
    } catch (error) {
      console.error("Doctor login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// GET /api/doctor-auth/me - Get current doctor info
doctorAuthController.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(
      token,
      process.env.DOCTOR_JWT_SECRET || process.env.ACCESS_TOKEN_SECRET
    );

    const doctor = await Doctor.findById(decoded.userId).select(
      "-password -refreshTokens"
    );
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.json({
      success: true,
      doctor,
    });
  } catch (error) {
    console.error("Get doctor info error:", error);
    res.status(401).json({ message: "Invalid token" });
  }
});

// POST /api/doctor-auth/logout - Doctor logout
doctorAuthController.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.DOCTOR_JWT_SECRET || process.env.REFRESH_TOKEN_SECRET
        );

        const doctor = await Doctor.findById(decoded.userId);
        if (doctor && decoded.jti) {
          // Invalidate the refresh token
          const tokenRecord = doctor.refreshTokens.find(
            (t) => t.jti === decoded.jti
          );
          if (tokenRecord) {
            tokenRecord.invalidated = true;
            await doctor.save();
          }
        }
      } catch (error) {
        console.error("Logout token verification error:", error);
      }
    }

    clearRefreshTokenCookie(res, req);
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Error during logout" });
  }
});

module.exports = doctorAuthController;
