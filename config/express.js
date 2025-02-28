require("dotenv").config();
const express = require("express");
const cors = require("../middleware/cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");

module.exports = (app) => {
  app.use("*", cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ✅ Add Express Session Middleware
  app.use(
    session({
      secret: "123123123", // Change this to a strong secret key
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }, // Set `true` in production with HTTPS
    })
  );

  console.log("✅ Express Session Initialized");
};
