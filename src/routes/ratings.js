const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const {
  submitRating,
  getDoctorRating,
  canRateDoctor,
} = require("../../controllers/ratings");

// Submit rating for doctor (POST /api/ratings/submit) - requires auth
router.post("/submit", authenticateToken, submitRating);

// Get doctor's aggregate rating (GET /api/ratings/doctor/:doctorId) - public endpoint
router.get("/doctor/:doctorId", getDoctorRating);

// Debug endpoint removed - routes are working

// Check if patient can rate doctor (GET /api/ratings/can-rate/:doctorId/:appointmentId) - requires auth
router.get(
  "/can-rate/:doctorId/:appointmentId",
  authenticateToken,
  canRateDoctor
);

module.exports = router;
