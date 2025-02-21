require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
    if (!token) {
      return res.status(401).json({ message: "No access token provided" });
    }

    try {
      const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      if (!verified.userId) {
        return res.status(401).json({ message: "Invalid token format" });
      }

      const user = await User.findById(verified.userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      req.user = user;
      return next();
    } catch (tokenError) {
      return res.status(401).json({
        message: "Invalid or expired token",
        error: tokenError.message,
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      message: "Authentication error",
      error: error.message,
    });
  }
};

module.exports = { authenticateToken };
