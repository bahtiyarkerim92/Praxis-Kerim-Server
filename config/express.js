require("dotenv").config();
const express = require("express");
const cors = require("../middleware/cors");
const cookieParser = require("cookie-parser");

module.exports = (app) => {
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(express.json({ limit: "10mb" }));
  app.use("*", cors());
  app.use(cookieParser());

  console.log("✅ Express Session Initialized");
};
