const Rating = require("../models/Rating");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

// Submit a rating for a doctor after appointment
const submitRating = async (req, res) => {
  try {
    const { doctorId, appointmentId, rating } = req.body;
    const patientId = req.user._id || req.user.userId;

    // Validate rating value
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Verify appointment exists and belongs to patient
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: patientId,
      doctorId: doctorId,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found or access denied",
      });
    }

    // Check if appointment is completed (for privacy, allow rating even during call)
    // This allows rating right after file transfer during the call

    // Check if rating already exists
    const existingRating = await Rating.findOne({
      doctorId,
      patientId,
      appointmentId,
    });

    if (existingRating) {
      // Update existing rating
      existingRating.rating = rating;
      await existingRating.save();
    } else {
      // Create new rating
      await Rating.create({
        doctorId,
        patientId,
        appointmentId,
        rating,
      });
    }

    // Update doctor's aggregate rating
    await updateDoctorRating(doctorId);

    res.json({
      success: true,
      message: "Rating submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit rating",
    });
  }
};

// Get ratings for a doctor (aggregated data only for privacy)
const getDoctorRating = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await Doctor.findById(doctorId).select(
      "rating name specialties"
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.json({
      success: true,
      data: {
        doctorId: doctor._id,
        name: doctor.name,
        specialties: doctor.specialties,
        rating: doctor.rating || { average: 0, count: 0 },
      },
    });
  } catch (error) {
    console.error("Error fetching doctor rating:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rating",
    });
  }
};

// Check if patient can rate this doctor (has completed appointment)
const canRateDoctor = async (req, res) => {
  try {
    const { doctorId, appointmentId } = req.params;
    const patientId = req.user._id || req.user.userId;

    // Check if appointment exists and belongs to patient
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: patientId,
      doctorId: doctorId,
    });

    if (!appointment) {
      return res.json({
        success: true,
        canRate: false,
        reason: "Appointment not found",
      });
    }

    // Check if already rated
    const existingRating = await Rating.findOne({
      doctorId,
      patientId,
      appointmentId,
    });

    res.json({
      success: true,
      canRate: true,
      hasRated: !!existingRating,
      currentRating: existingRating?.rating || null,
    });
  } catch (error) {
    console.error("Error checking rating eligibility:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check rating eligibility",
    });
  }
};

// Helper function to update doctor's aggregate rating
async function updateDoctorRating(doctorId) {
  try {
    // Calculate aggregate rating from all ratings
    const ratings = await Rating.find({ doctorId });

    const count = ratings.length;
    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    const average = count > 0 ? Number((total / count).toFixed(1)) : 0;

    // Update doctor document
    await Doctor.findByIdAndUpdate(doctorId, {
      "rating.average": average,
      "rating.count": count,
      "rating.total": total,
    });

    console.log(
      `Updated doctor ${doctorId} rating: ${average}/5 (${count} ratings)`
    );
  } catch (error) {
    console.error("Error updating doctor rating:", error);
  }
}

module.exports = {
  submitRating,
  getDoctorRating,
  canRateDoctor,
  updateDoctorRating,
};
