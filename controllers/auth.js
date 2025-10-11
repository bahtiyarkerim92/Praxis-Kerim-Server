require("dotenv").config();
const authController = require("express").Router();
const Admin = require("../models/Admin");
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

// Validation rules for admin login
const adminLoginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// POST /auth/login - Admin login
authController.post(
  "/login",
  adminLoginValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find admin
      const admin = await Admin.findOne({ email });

      if (!admin) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken(admin._id, "admin");
      const refreshToken = await generateRefreshToken(admin._id, "admin");

      console.log("🔑 Generated access token for admin:", admin.email);
      console.log("🍪 Setting refresh token cookie...");

      // Store refresh token
      await storeRefreshToken(admin, refreshToken);

      // Set refresh token cookie
      setRefreshTokenCookie(res, refreshToken.token);

      console.log("✅ Login successful for admin:", admin.email);

      return res.status(200).json({
        success: true,
        message: "Login successful",
        accessToken,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        message: "Login failed",
        error: error.message,
      });
    }
  }
);

// POST /auth/refresh - Refresh access token
authController.post("/refresh", async (req, res) => {
  try {
    console.log("🔄 Refresh token request received");
    console.log("📦 Cookies:", req.cookies);
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      console.log("❌ No refresh token found in cookies");
      return res.status(401).json({
        message: "Refresh token not found",
      });
    }

    console.log("✅ Refresh token found, verifying...");
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log("✅ Token verified for user:", decoded.userId);

    if (decoded.userType !== "admin") {
      return res.status(403).json({
        message: "Invalid token type",
      });
    }

    // Find admin and verify token
    const admin = await Admin.findById(decoded.userId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const tokenRecord = admin.refreshTokens.find(
      (t) => t.jti === decoded.jti && !t.invalidated
    );

    if (!tokenRecord) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(admin._id, "admin");
    const newRefreshToken = await generateRefreshToken(admin._id, "admin");

    console.log("🔄 Generating new tokens for admin:", admin.email);

    // Invalidate old token
    tokenRecord.invalidated = true;
    await storeRefreshToken(admin, newRefreshToken);

    // Set new refresh token cookie
    setRefreshTokenCookie(res, newRefreshToken.token);

    console.log("✅ Refresh successful, new tokens issued");

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(401).json({
      message: "Invalid refresh token",
    });
  }
});

// GET /auth/me - Get current admin
authController.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Access token required",
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (decoded.userType !== "admin") {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    const admin = await Admin.findById(decoded.userId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token expired",
      });
    }

    return res.status(403).json({
      message: "Invalid access token",
    });
  }
});

// POST /auth/logout - Logout
authController.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET
        );
        const admin = await Admin.findById(decoded.userId);

        if (admin) {
          const tokenRecord = admin.refreshTokens.find(
            (t) => t.jti === decoded.jti
          );
          if (tokenRecord) {
            tokenRecord.invalidated = true;
            await admin.save();
          }
        }
      } catch (err) {
        console.log("Error invalidating token:", err.message);
      }
    }

    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      message: "Logout failed",
    });
  }
});

module.exports = authController;
