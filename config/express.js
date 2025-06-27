require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("../middleware/cors");
const cookieParser = require("cookie-parser");

module.exports = (app) => {
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(express.json({ limit: "10mb" }));
  app.use("*", cors());
  app.use(cookieParser());

  // Serve static files from uploads directory
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  console.log("✅ Express Session Initialized");
};
