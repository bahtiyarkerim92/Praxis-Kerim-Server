const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");

const router = express.Router();

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// GET /api/patients - Get all patients (for doctors)
router.get(
  "/",
  authenticateDoctorToken,
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { limit = 20, page = 1, search } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build search filter
      const filter = {};
      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      // Find patients who have appointments with this doctor
      const doctor = await Doctor.findById(req.doctor._id);
      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found",
        });
      }

      // Get patient IDs who have appointments with this doctor
      const patientAppointments = await Appointment.find({
        doctorId: req.doctor._id,
      }).distinct("patientId");

      // Add patient filter to only include patients with appointments
      filter._id = { $in: patientAppointments };

      const patients = await User.find(filter)
        .select("-password -refreshTokens")
        .sort({ firstName: 1, lastName: 1 })
        .limit(parseInt(limit))
        .skip(skip);

      // Get total count for pagination
      const totalPatients = await User.countDocuments(filter);

      // Add appointment count for each patient
      const patientsWithStats = await Promise.all(
        patients.map(async (patient) => {
          const appointmentCount = await Appointment.countDocuments({
            patientId: patient._id,
            doctorId: req.doctor._id,
          });

          const upcomingCount = await Appointment.countDocuments({
            patientId: patient._id,
            doctorId: req.doctor._id,
            status: "upcoming",
          });

          const completedCount = await Appointment.countDocuments({
            patientId: patient._id,
            doctorId: req.doctor._id,
            status: "completed",
          });

          return {
            ...patient.toObject(),
            appointmentStats: {
              total: appointmentCount,
              upcoming: upcomingCount,
              completed: completedCount,
            },
          };
        })
      );

      res.json({
        success: true,
        data: patientsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPatients / parseInt(limit)),
          totalPatients,
          hasNextPage: skip + patients.length < totalPatients,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({
        message: "Error fetching patients",
        error: error.message,
      });
    }
  }
);

// GET /api/patients/:id - Get single patient details
router.get(
  "/:id",
  authenticateDoctorToken,
  [param("id").isMongoId().withMessage("Invalid patient ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const patient = await User.findById(req.params.id).select(
        "-password -refreshTokens"
      );

      if (!patient) {
        return res.status(404).json({
          message: "Patient not found",
        });
      }

      // Check if this doctor has appointments with this patient
      const hasAppointments = await Appointment.findOne({
        patientId: req.params.id,
        doctorId: req.doctor._id,
      });

      if (!hasAppointments) {
        return res.status(403).json({
          message: "You don't have access to this patient's information",
        });
      }

      // Get appointment statistics
      const appointmentStats = {
        total: await Appointment.countDocuments({
          patientId: req.params.id,
          doctorId: req.doctor._id,
        }),
        upcoming: await Appointment.countDocuments({
          patientId: req.params.id,
          doctorId: req.doctor._id,
          status: "upcoming",
        }),
        completed: await Appointment.countDocuments({
          patientId: req.params.id,
          doctorId: req.doctor._id,
          status: "completed",
        }),
        cancelled: await Appointment.countDocuments({
          patientId: req.params.id,
          doctorId: req.doctor._id,
          status: "cancelled",
        }),
      };

      // Add profile completion status
      const profileCompleted = !!(
        patient.firstName &&
        patient.lastName &&
        patient.gender &&
        patient.birthday
      );

      res.json({
        success: true,
        data: {
          ...patient.toObject(),
          appointmentStats,
          profileCompleted,
          isProfileComplete: profileCompleted, // Add both fields for compatibility
        },
      });
    } catch (error) {
      console.error("Error fetching patient details:", error);
      res.status(500).json({
        message: "Error fetching patient details",
        error: error.message,
      });
    }
  }
);

// GET /api/patients/:id/appointments - Get patient's appointments with this doctor
router.get(
  "/:id/appointments",
  authenticateDoctorToken,
  [
    param("id").isMongoId().withMessage("Invalid patient ID"),
    query("status")
      .optional()
      .isIn(["upcoming", "completed", "cancelled", "all"])
      .withMessage("Invalid status filter"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status = "all", limit = 20, page = 1 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Check if this doctor has appointments with this patient
      const hasAppointments = await Appointment.findOne({
        patientId: req.params.id,
        doctorId: req.doctor._id,
      });

      if (!hasAppointments) {
        return res.status(403).json({
          message: "You don't have access to this patient's appointments",
        });
      }

      // Build filter
      const filter = {
        patientId: req.params.id,
        doctorId: req.doctor._id,
      };

      if (status !== "all") {
        filter.status = status;
      }

      const appointments = await Appointment.find(filter)
        .populate("doctorId", "name email specialties photoUrl")
        .populate("patientId", "firstName lastName email")
        .sort({ date: -1, slot: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      // Get total count for pagination
      const totalAppointments = await Appointment.countDocuments(filter);

      res.json({
        success: true,
        data: appointments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalAppointments / parseInt(limit)),
          totalAppointments,
          hasNextPage: skip + appointments.length < totalAppointments,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching patient appointments:", error);
      res.status(500).json({
        message: "Error fetching patient appointments",
        error: error.message,
      });
    }
  }
);

module.exports = router;
