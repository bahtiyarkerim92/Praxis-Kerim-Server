const Rating = require("../models/Rating");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");

/**
 * Submit rating for doctor after completed appointment
 * POST /api/ratings/submit
 * Requires authentication
 */
exports.submitRating = async (req, res) => {
  try {
    const { doctorId, appointmentId, rating, isAnonymous } = req.body;
    const patientId = req.user.userId;

    // Validate rating value
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Validate required fields
    if (!doctorId || !appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID and Appointment ID are required",
      });
    }

    // Check if appointment exists and belongs to the patient
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: patientId,
      doctorId: doctorId,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found or does not belong to you",
      });
    }

    // Check if appointment is completed
    if (appointment.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "You can only rate completed appointments",
      });
    }

    // Check if rating already exists
    const existingRating = await Rating.findOne({
      doctorId,
      patientId,
      appointmentId,
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this appointment",
      });
    }

    // Verify doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Create rating
    const newRating = new Rating({
      doctorId,
      patientId,
      appointmentId,
      rating,
      isAnonymous: isAnonymous !== undefined ? isAnonymous : true,
    });

    await newRating.save();

    res.status(201).json({
      success: true,
      message: "Rating submitted successfully",
      data: {
        rating: newRating.rating,
        isAnonymous: newRating.isAnonymous,
      },
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit rating",
      error: error.message,
    });
  }
};

/**
 * Get doctor's aggregate rating
 * GET /api/ratings/doctor/:doctorId
 * Public endpoint
 */
exports.getDoctorRating = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Validate doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Get all ratings for the doctor
    const ratings = await Rating.find({ doctorId });

    if (ratings.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0,
          },
        },
      });
    }

    // Calculate average rating
    const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = (totalRating / ratings.length).toFixed(1);

    // Calculate rating distribution
    const ratingDistribution = {
      5: ratings.filter((r) => r.rating === 5).length,
      4: ratings.filter((r) => r.rating === 4).length,
      3: ratings.filter((r) => r.rating === 3).length,
      2: ratings.filter((r) => r.rating === 2).length,
      1: ratings.filter((r) => r.rating === 1).length,
    };

    res.status(200).json({
      success: true,
      data: {
        averageRating: parseFloat(averageRating),
        totalRatings: ratings.length,
        ratingDistribution,
      },
    });
  } catch (error) {
    console.error("Error getting doctor rating:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get doctor rating",
      error: error.message,
    });
  }
};

/**
 * Check if patient can rate doctor for specific appointment
 * GET /api/ratings/can-rate/:doctorId/:appointmentId
 * Requires authentication
 */
exports.canRateDoctor = async (req, res) => {
  try {
    const { doctorId, appointmentId } = req.params;
    const patientId = req.user.userId;

    // Check if appointment exists and belongs to the patient
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: patientId,
      doctorId: doctorId,
    });

    if (!appointment) {
      return res.status(200).json({
        success: true,
        data: {
          canRate: false,
          reason: "Appointment not found or does not belong to you",
        },
      });
    }

    // Check if appointment is completed
    if (appointment.status !== "completed") {
      return res.status(200).json({
        success: true,
        data: {
          canRate: false,
          reason: "Appointment not completed yet",
        },
      });
    }

    // Check if rating already exists
    const existingRating = await Rating.findOne({
      doctorId,
      patientId,
      appointmentId,
    });

    if (existingRating) {
      return res.status(200).json({
        success: true,
        data: {
          canRate: false,
          reason: "You have already rated this appointment",
          existingRating: {
            rating: existingRating.rating,
            createdAt: existingRating.createdAt,
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        canRate: true,
        reason: "You can rate this appointment",
      },
    });
  } catch (error) {
    console.error("Error checking if can rate:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check rating eligibility",
      error: error.message,
    });
  }
};
