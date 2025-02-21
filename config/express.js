require("dotenv").config();
const express = require("express");
const cors = require("../middleware/cors");
const cookieParser = require("cookie-parser");

module.exports = (app) => {
  app.use("*", cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
};
