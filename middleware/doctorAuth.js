require("dotenv").config();
const Doctor = require("../models/Doctor");
const jwt = require("jsonwebtoken");
const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require("../services/cookie/cookieService");

// Verify doctor JWT token
const verifyDoctorToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error("Invalid token");
  }
};

// Generate new doctor access token
const generateDoctorAccessToken = (doctor) => {
  return jwt.sign(
    {
      userId: doctor._id,
      email: doctor.email,
      isDoctor: doctor.isDoctor,
      isAdmin: doctor.isAdmin,
      userType: "doctor",
    },
    process.env.DOCTOR_JWT_SECRET,
    { expiresIn: "15m" }
  );
};

// Generate new doctor refresh token
const generateDoctorRefreshToken = (doctor) => {
  const jti = require("crypto").randomBytes(16).toString("hex");
  const token = jwt.sign(
    {
      userId: doctor._id,
      jti,
      userType: "doctor",
    },
    process.env.DOCTOR_JWT_SECRET,
    { expiresIn: "7d" }
  );
  return { token, jti };
};

// Store doctor refresh token
const storeDoctorRefreshToken = async (doctor, token, jti) => {
  doctor.refreshTokens.push({
    token,
    jti,
    createdAt: new Date(),
    invalidated: false,
  });
  await doctor.save();
};

// Invalidate doctor refresh token
const invalidateDoctorRefreshToken = async (doctor, jti) => {
  const tokenRecord = doctor.refreshTokens.find((t) => t.jti === jti);
  if (tokenRecord) {
    tokenRecord.invalidated = true;
    await doctor.save();
  }
};

// Main doctor authentication middleware
const authenticateDoctorToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
    const refreshToken = req.cookies.refreshToken;

    // No tokens available
    if (!accessToken && !refreshToken) {
      return res.status(401).json({ message: "No tokens provided" });
    }

    // First try to validate access token if present
    if (accessToken) {
      try {
        console.log(
          "🔍 Verifying access token with secret:",
          process.env.DOCTOR_JWT_SECRET
            ? "DOCTOR_JWT_SECRET found"
            : "DOCTOR_JWT_SECRET NOT FOUND"
        );
        const payload = verifyDoctorToken(
          accessToken,
          process.env.DOCTOR_JWT_SECRET
        );

        if (!payload || payload.userType !== "doctor") {
          throw new Error("Invalid access token");
        }

        const doctor = await Doctor.findById(payload.userId);

        if (!doctor) {
          return res.status(401).json({ message: "Doctor not found" });
        }

        if (!doctor.isActive) {
          return res.status(403).json({ message: "Account deactivated" });
        }

        req.doctor = doctor;
        req.accessToken = accessToken;
        req.isAuthenticated = true;

        return next();
      } catch (accessTokenError) {
        console.log("Access token invalid:", accessTokenError.message);
        console.log("Trying refresh token...");
      }
    }

    // Try refresh token if access token was invalid or not present
    if (refreshToken) {
      try {
        const payload = verifyDoctorToken(
          refreshToken,
          process.env.DOCTOR_JWT_SECRET
        );

        if (!payload || payload.userType !== "doctor") {
          throw new Error("Invalid refresh token");
        }

        const doctor = await Doctor.findById(payload.userId);

        if (!doctor) {
          clearRefreshTokenCookie(res, req);
          return res.status(401).json({ message: "Doctor not found" });
        }

        if (!doctor.isActive) {
          clearRefreshTokenCookie(res, req);
          return res.status(403).json({ message: "Account deactivated" });
        }

        // Handle token authentication and refresh
        return await handleDoctorTokenAuthentication(
          doctor,
          payload,
          refreshToken,
          req,
          res,
          next
        );
      } catch (refreshError) {
        console.error("Refresh token validation failed:", refreshError.message);
        console.error(
          "Refresh token secret used:",
          process.env.DOCTOR_JWT_SECRET
            ? "DOCTOR_JWT_SECRET"
            : "REFRESH_TOKEN_SECRET"
        );
        clearRefreshTokenCookie(res, req);
        return res.status(401).json({
          message: "Invalid refresh token",
          error: refreshError.message,
        });
      }
    }

    return res.status(401).json({ message: "Authentication failed" });
  } catch (error) {
    console.error("Doctor auth middleware error:", error);
    return res.status(500).json({
      message: "Authentication error",
      error: error.message,
    });
  }
};

// Helper function to handle doctor token authentication
async function handleDoctorTokenAuthentication(
  doctor,
  payload,
  refreshToken,
  req,
  res,
  next
) {
  const jti = payload.jti;
  if (!jti) {
    clearRefreshTokenCookie(res, req);
    return res.status(401).json({ message: "Invalid token format" });
  }

  // Find the token in the doctor's tokens
  const tokenRecord = doctor.refreshTokens.find((t) => t.jti === jti);

  // Token not found
  if (!tokenRecord) {
    clearRefreshTokenCookie(res, req);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  // If token has been invalidated, reject it
  if (tokenRecord.invalidated) {
    clearRefreshTokenCookie(res, req);
    return res.status(401).json({ message: "Token has been invalidated" });
  }

  // Generate a new access token
  const newAccessToken = generateDoctorAccessToken(doctor);

  // Check if refresh token needs rotation (e.g., close to expiration)
  // JWT exp is in seconds since epoch, convert to milliseconds for Date
  const tokenExp = payload.exp * 1000;
  const now = Date.now();
  const timeUntilExpiration = tokenExp - now;
  const shouldRotateToken = timeUntilExpiration < 24 * 60 * 60 * 1000; // Rotate if less than 24 hours left

  // Only rotate token if needed
  if (shouldRotateToken) {
    // Invalidate the current token
    await invalidateDoctorRefreshToken(doctor, jti);

    // Generate a new refresh token
    const { token: newRefreshToken, jti: newJti } =
      generateDoctorRefreshToken(doctor);

    // Store the new token
    await storeDoctorRefreshToken(doctor, newRefreshToken, newJti);

    // Save the doctor with updated tokens
    await doctor.save();

    // Set the new refresh token cookie
    setRefreshTokenCookie(res, newRefreshToken, req);
  }

  // Set the doctor and new access token
  req.doctor = doctor;
  req.accessToken = newAccessToken;
  req.isAuthenticated = true;
  req.headers.authorization = `Bearer ${newAccessToken}`;

  return next();
}

// Middleware to require admin access
const requireDoctorAdmin = (req, res, next) => {
  if (!req.doctor || !req.doctor.isAdmin) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }
  next();
};

// Middleware to require doctor role (not just admin)
const requireDoctorRole = (req, res, next) => {
  if (!req.doctor || !req.doctor.isDoctor) {
    return res.status(403).json({
      message:
        "Doctor role required. This action is not available for admin-only accounts.",
    });
  }
  next();
};

// Optional authentication middleware (doesn't reject if no token)
const optionalDoctorAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    if (accessToken) {
      try {
        const payload = verifyDoctorToken(
          accessToken,
          process.env.DOCTOR_JWT_SECRET
        );

        if (payload && payload.userType === "doctor") {
          const doctor = await Doctor.findById(payload.userId);
          if (doctor && doctor.isActive) {
            req.doctor = doctor;
            req.isAuthenticated = true;
          }
        }
      } catch (error) {
        // Silent fail for optional auth
        console.log("Optional doctor auth failed:", error.message);
      }
    }

    next();
  } catch (error) {
    console.error("Optional doctor auth error:", error);
    next();
  }
};

module.exports = {
  authenticateDoctorToken,
  requireDoctorAdmin,
  requireDoctorRole,
  optionalDoctorAuth,
};
