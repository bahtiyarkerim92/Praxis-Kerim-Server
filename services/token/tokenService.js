require("dotenv").config();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

function generateAccessToken(userId, userType) {
  return jwt.sign({ userId, userType }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "30m",
  });
}

function generateRefreshToken(userId, userType) {
  const jti = new mongoose.Types.ObjectId().toString(); // Unique token ID

  const token = jwt.sign(
    {
      userId,
      userType,
      jti,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: "7d",
    }
  );

  return { token, jti };
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
 * @param {Object} refreshToken - Object with token and jti properties
 * @returns {Promise} Promise resolving to updated user
 */
async function storeRefreshToken(user, refreshToken) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Re-fetch the user to get the latest version
      const Admin = require("../../models/Admin");
      const freshUser = await Admin.findById(user._id);

      if (!freshUser) {
        throw new Error("User not found");
      }

      // If refreshTokens doesn't exist or is not an array, initialize it
      if (!freshUser.refreshTokens || !Array.isArray(freshUser.refreshTokens)) {
        freshUser.refreshTokens = [];
      }

      // Keep only the last 5 tokens (for security)
      if (freshUser.refreshTokens.length >= 5) {
        freshUser.refreshTokens = freshUser.refreshTokens.slice(-4);
      }

      // Create the new token object
      const newToken = {
        token: refreshToken.token,
        jti: refreshToken.jti,
        createdAt: new Date(),
        invalidated: false,
        invalidatedAt: null,
      };

      // Add the new token
      freshUser.refreshTokens.push(newToken);

      // Clean up old tokens (older than 7 days)
      await cleanupOldTokens(freshUser);

      return await freshUser.save();
    } catch (error) {
      lastError = error;

      // If it's a version error and we have retries left, try again
      if (error.name === "VersionError" && attempt < maxRetries - 1) {
        console.log(
          `⚠️ Version conflict, retrying... (attempt ${attempt + 1}/${maxRetries})`
        );
        // Wait a bit before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 50 * Math.pow(2, attempt))
        );
        continue;
      }

      console.error("🔴 [Token Service] Error storing refresh token:", error);
      throw error;
    }
  }

  throw lastError;
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
  verifyToken,
  storeRefreshToken,
  invalidateRefreshToken,
  cleanupOldTokens,
};
