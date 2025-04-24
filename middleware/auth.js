require("dotenv").config();
const User = require("../models/User");
const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require("../services/cookie/cookieService");
const {
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  invalidateRefreshToken,
} = require("../services/token/tokenService");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
    const refreshToken = req.cookies.refreshToken;

    // No tokens available
    if (!accessToken && !refreshToken) {
      // For SSR requests, we'll allow the request to proceed but mark as unauthenticated

      return res.status(401).json({ message: "No tokens provided" });
    }

    // First try to validate access token if present
    if (accessToken) {
      try {
        const payload = verifyToken(
          accessToken,
          process.env.ACCESS_TOKEN_SECRET
        );

        if (!payload) {
          throw new Error("Invalid access token");
        }

        const user = await User.findById(payload.userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }
        req.user = user;
        req.accessToken = accessToken;
        req.isAuthenticated = true;

        return next();
      } catch (accessTokenError) {}
    }

    // Try refresh token if access token was invalid or not present
    if (refreshToken) {
      try {
        const payload = verifyToken(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET
        );

        if (!payload) {
          throw new Error("Invalid refresh token");
        }

        const user = await User.findById(payload.userId);

        if (!user) {
          // For SSR requests, proceed as unauthenticated

          clearRefreshTokenCookie(res, req);
          return res.status(401).json({ message: "User not found" });
        }

        // Process token with new format
        return await handleTokenAuthentication(
          user,
          payload,
          refreshToken,
          req,
          res,
          next
        );
      } catch (refreshError) {
        console.error(
          "🔑 [Auth Middleware] Refresh token validation failed:",
          refreshError.message
        );

        // For SSR requests, proceed as unauthenticated

        clearRefreshTokenCookie(res, req);
        return res.status(401).json({
          message: "Invalid refresh token",
          error: refreshError.message,
        });
      }
    }

    return res.status(401).json({ message: "Authentication failed" });
  } catch (error) {
    console.error("🔴 [Auth Middleware] Error:", error);

    return res.status(500).json({
      message: "Authentication error",
      error: error.message,
    });
  }
};

// Helper function to handle token authentication
async function handleTokenAuthentication(
  user,
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
  // Find the token in the user's tokens
  const tokenRecord = user.refreshTokens.find((t) => t.jti === jti);

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
  const newAccessToken = generateAccessToken(user);

  // Check if refresh token needs rotation (e.g., close to expiration)
  // JWT exp is in seconds since epoch, convert to milliseconds for Date
  const tokenExp = payload.exp * 1000;
  const now = Date.now();
  const timeUntilExpiration = tokenExp - now;
  const shouldRotateToken = timeUntilExpiration < 24 * 60 * 60 * 1000; // Rotate if less than 24 hours left

  // Only rotate token if needed
  if (shouldRotateToken) {
    // Invalidate the current token
    await invalidateRefreshToken(user, jti);

    // Generate a new refresh token
    const { token: newRefreshToken, jti: newJti } = generateRefreshToken(user);

    // Store the new token
    await storeRefreshToken(user, newRefreshToken, newJti);

    // Save the user with updated tokens
    await user.save();

    // Set the new refresh token cookie
    setRefreshTokenCookie(res, newRefreshToken, req);
  }

  // Set the user and new access token
  req.user = user;
  req.accessToken = newAccessToken;
  req.isAuthenticated = true;
  req.headers.authorization = `Bearer ${newAccessToken}`;

  return next();
}

module.exports = { authenticateToken };
