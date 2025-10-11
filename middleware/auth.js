const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

// Authenticate admin token
const authenticateToken = async (req, res, next) => {
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

    req.admin = admin;
    next();
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
};

module.exports = {
  authenticateToken,
};
