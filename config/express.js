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

  // Add Express Session Middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "123123123", // Change this to a strong secret key
      resave: true,
      saveUninitialized: true,
      cookie: {
        secure: false, // Set to false to work on http localhost
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: "none",
        path: "/",
        domain: "localhost",
      },
      name: "telemedker.sid", // Custom session name
    })
  );

  // Add middleware to log session data on each request (for debugging)
  app.use((req, res, next) => {
    console.log(`Request to ${req.method} ${req.path}`);
    console.log(`Session ID: ${req.sessionID}`);

    // Ensure session stays active
    req.session.touch();

    next();
  });

  console.log("✅ Express Session Initialized");
};
