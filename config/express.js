require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("../middleware/cors");
const cookieParser = require("cookie-parser");

module.exports = (app) => {
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Apply JSON parser to all routes EXCEPT file upload routes
  app.use((req, res, next) => {
    // Skip JSON parsing for file upload routes
    if (
      req.path.includes("/upload") ||
      req.path.includes("/documents/patient-upload")
    ) {
      return next();
    }
    express.json({ limit: "10mb" })(req, res, next);
  });

  app.use("*", cors());
  app.use(cookieParser());

  // Serve static files from uploads directory
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  console.log("✅ Express Session Initialized");
};
