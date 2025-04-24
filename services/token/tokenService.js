require("dotenv").config();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

function generateAccessToken(user) {
  return jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "30m",
  });
}

function generateRefreshToken(user) {
  const jti = new mongoose.Types.ObjectId().toString(); // Unique token ID

  const token = jwt.sign(
    {
      userId: user._id,
      jti,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: "7d",
    }
  );

  return { token, jti };
}

function generateValidationToken(user) {
  return jwt.sign({ userId: user._id }, process.env.EMAIL_TOKEN_SECRET, {
    expiresIn: "1h",
  });
}

function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Store a refresh token for a user
 * @param {Object} user - User document
 * @param {string} token - JWT refresh token
 * @param {string} jti - JWT ID
 * @returns {Promise} Promise resolving to updated user
 */
async function storeRefreshToken(user, token, jti) {
  try {
    // If refreshTokens doesn't exist or is not an array, initialize it
    if (!user.refreshTokens || !Array.isArray(user.refreshTokens)) {
      user.refreshTokens = [];
    }

    // Keep only the last 5 tokens (for security)
    if (user.refreshTokens.length >= 5) {
      // Log which tokens are being removed
      const tokensBeingRemoved = user.refreshTokens.slice(
        0,
        user.refreshTokens.length - 4
      );
      user.refreshTokens = user.refreshTokens.slice(-4);
    }

    // Create the new token object
    const newToken = {
      token,
      jti,
      createdAt: new Date(),
      invalidated: false,
      invalidatedAt: null,
    };

    // Add the new token
    user.refreshTokens.push(newToken);

    // Clean up old tokens (older than 7 days)
    await cleanupOldTokens(user);

    return await user.save();
  } catch (error) {
    console.error("🔴 [Token Service] Error storing refresh token:", error);
    throw error;
  }
}

/**
 * Invalidate a refresh token by JTI
 * @param {Object} user - User document
 * @param {string} jti - JWT ID to invalidate
 * @returns {Promise} Promise resolving to updated user
 */
async function invalidateRefreshToken(user, jti) {
  try {
    // If refreshTokens doesn't exist or is not an array, initialize it
    if (!user.refreshTokens || !Array.isArray(user.refreshTokens)) {
      user.refreshTokens = [];
      return user;
    }

    // Find the token before invalidation
    const tokenBeforeUpdate = user.refreshTokens.find((t) => t.jti === jti);

    // Mark the token as invalidated with a timestamp
    const now = new Date();
    user.refreshTokens = user.refreshTokens.map((tokenObj) =>
      tokenObj.jti === jti
        ? { ...tokenObj, invalidated: true, invalidatedAt: now }
        : tokenObj
    );

    // Find the token after invalidation for logging
    const tokenAfterUpdate = user.refreshTokens.find((t) => t.jti === jti);

    return user;
  } catch (error) {
    console.error(
      "🔴 [Token Service] Error invalidating refresh token:",
      error
    );
    return user; // Return user even if there's an error to prevent blocking the flow
  }
}

/**
 * Clean up old tokens from a user document
 * @param {Object} user - User document
 * @returns {void}
 */
async function cleanupOldTokens(user) {
  try {
    // If refreshTokens doesn't exist or is not an array, initialize it
    if (!user.refreshTokens || !Array.isArray(user.refreshTokens)) {
      user.refreshTokens = [];
      return;
    }

    // Only process if we have tokens in the new format
    if (
      user.refreshTokens.length > 0 &&
      typeof user.refreshTokens[0] === "object" &&
      user.refreshTokens[0] !== null
    ) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Count tokens before cleanup
      const totalTokens = user.refreshTokens.length;
      const invalidatedTokens = user.refreshTokens.filter(
        (t) => t.invalidated
      ).length;

      // Keep tokens that are either:
      // 1. Not invalidated, or
      // 2. Less than 7 days old
      const tokensBeforeCleanup = [...user.refreshTokens];

      user.refreshTokens = user.refreshTokens.filter(
        (tokenObj) =>
          !tokenObj.invalidated ||
          (tokenObj.createdAt && tokenObj.createdAt > sevenDaysAgo)
      );

      if (user.refreshTokens.length > 10) {
        // Sort by creation date (newest first) and keep only the 10 newest
        user.refreshTokens.sort(
          (a, b) => (b.createdAt || new Date()) - (a.createdAt || new Date())
        );

        user.refreshTokens = user.refreshTokens.slice(0, 10);
      }
    }
  } catch (error) {
    console.error("🔴 [Token Service] Error cleaning up old tokens:", error);
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateValidationToken,
  verifyToken,
  storeRefreshToken,
  invalidateRefreshToken,
  cleanupOldTokens,
};
