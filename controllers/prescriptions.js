const express = require("express");
const router = express.Router();
const Prescription = require("../models/Prescription");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const { uploadSingle } = require("../services/aws/pdfUpload");
const {
  uploadPrescription,
  generatePresignedUrl,
  deletePrescription,
} = require("../services/aws/prescriptionUpload");
const { authenticateToken } = require("../middleware/auth");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");

// Upload prescription PDF (Doctor only)
router.post("/upload", authenticateDoctorToken, (req, res) => {
  console.log("Prescription upload attempt - Doctor:", req.doctor?._id);

  uploadSingle(req, res, async function (err) {
    if (err) {
      console.error("PDF upload error:", err);

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB.",
        });
      }

      if (err.message === "Only PDF files are allowed!") {
        return res.status(400).json({
          success: false,
          message: "Only PDF files are allowed!",
        });
      }

      return res.status(400).json({
        success: false,
        message: "File upload error",
        error: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No PDF file uploaded",
      });
    }

    try {
      const {
        patientId,
        title,
        medications,
        generalInstructions,
        validUntil,
        diagnosis,
        diagnoses,
        notes,
        followUpRequired,
        followUpDate,
        followUpNotes,
        pharmacyName,
        pharmacyAddress,
        pharmacyPhone,
        isFreePresc,
        freePrescriptionNotes,
      } = req.body;

      // Validate required fields
      if (!patientId || !title || !validUntil) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: patientId, title, validUntil",
        });
      }

      // Parse medications if provided as string
      let parsedMedications = [];
      if (medications) {
        try {
          parsedMedications =
            typeof medications === "string"
              ? JSON.parse(medications)
              : medications;
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid medications format",
          });
        }
      }

      // Parse diagnoses if provided as string, handle both single and multiple
      let parsedDiagnoses = [];
      if (diagnoses) {
        try {
          parsedDiagnoses =
            typeof diagnoses === "string" ? JSON.parse(diagnoses) : diagnoses;
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid diagnoses format",
          });
        }
      } else if (diagnosis) {
        // Backward compatibility: convert single diagnosis to array
        parsedDiagnoses = [diagnosis];
      }

      // Verify patient exists
      const patient = await User.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      // Upload file using the new service
      const uploadResult = await uploadPrescription(patientId, req.file);

      if (!uploadResult.success) {
        return res.status(400).json({
          success: false,
          message: uploadResult.error.message,
          error: uploadResult.error,
        });
      }

      // Create prescription record
      const prescription = new Prescription({
        patientId,
        doctorId: req.doctor._id,
        title,
        medications: parsedMedications,
        generalInstructions,
        prescriptionDate: new Date(),
        validUntil: new Date(validUntil),
        diagnosis:
          parsedDiagnoses.length === 1 ? parsedDiagnoses[0] : undefined, // For backward compatibility
        diagnoses: parsedDiagnoses.length > 0 ? parsedDiagnoses : undefined,
        notes,
        pdfUrl: uploadResult.data.fileUrl,
        pdfKey: uploadResult.data.key,
        originalFileName: uploadResult.data.originalFilename,
        fileSize: uploadResult.data.fileSize,
        isFreePresc: isFreePresc === "true" || isFreePresc === true,
        freePrescriptionNotes,
        followUp: {
          required: followUpRequired === "true" || followUpRequired === true,
          date: followUpDate ? new Date(followUpDate) : undefined,
          notes: followUpNotes,
        },
        pharmacy: {
          name: pharmacyName,
          address: pharmacyAddress,
          phone: pharmacyPhone,
        },
      });

      await prescription.save();

      // Populate doctor and patient info for response
      await prescription.populate("doctorId", "name email");
      await prescription.populate("patientId", "firstName lastName email");

      console.log("Prescription created successfully:", prescription._id);

      res.json({
        success: true,
        message: "Prescription uploaded successfully",
        prescription,
        uploadData: uploadResult.data,
      });
    } catch (uploadError) {
      console.error("Prescription upload error:", uploadError);
      res.status(500).json({
        success: false,
        message: "Failed to upload prescription",
        error: uploadError.message,
      });
    }
  });
});

// Get presigned URL for viewing a prescription PDF (Doctor only)
router.get("/:id/pdf", authenticateDoctorToken, async (req, res) => {
  try {
    const prescriptionId = req.params.id;

    // Find the prescription and verify doctor has access
    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      doctorId: req.doctor._id,
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found or access denied",
      });
    }

    // Generate presigned URL for secure access
    const presignedUrl = await generatePresignedUrl(prescription.pdfKey, 3600); // 1 hour expiry

    res.json({
      success: true,
      presignedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate secure access URL",
      error: error.message,
    });
  }
});

// Get presigned URL for viewing a prescription PDF (Patient only)
router.get("/:id/patient-pdf", authenticateToken, async (req, res) => {
  try {
    const prescriptionId = req.params.id;

    // Find the prescription and verify patient has access
    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      patientId: req.user._id,
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found or access denied",
      });
    }

    // Generate presigned URL for secure access
    const presignedUrl = await generatePresignedUrl(prescription.pdfKey, 3600); // 1 hour expiry

    res.json({
      success: true,
      presignedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate secure access URL",
      error: error.message,
    });
  }
});

// Get all prescriptions for a doctor
router.get("/doctor", authenticateDoctorToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, patientId, status } = req.query;

    const options = {};
    if (patientId) options.patientId = patientId;
    if (status) options.status = status;

    const prescriptions = await Prescription.findByDoctor(
      req.doctor._id,
      options
    )
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Prescription.countDocuments({
      doctorId: req.doctor._id,
      ...options,
    });

    res.json({
      success: true,
      data: prescriptions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching doctor's prescriptions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: error.message,
    });
  }
});

// Get all prescriptions for a patient
router.get("/patient", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    console.log("🔍 Patient prescriptions request - User ID:", req.user._id);
    const filter = { patientId: req.user._id };

    if (status) {
      filter.status = status;
    }

    const prescriptions = await Prescription.find(filter)
      .populate("doctorId", "name email specialties")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Prescription.countDocuments(filter);

    // Update expired prescriptions
    const expiredPrescriptions = prescriptions.filter(
      (p) => p.isExpired && p.status === "active"
    );
    for (const prescription of expiredPrescriptions) {
      prescription.status = "expired";
      await prescription.save();
    }

    res.json({
      success: true,
      data: prescriptions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching patient's prescriptions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: error.message,
    });
  }
});

// Get active prescriptions for a patient
router.get("/patient/active", authenticateToken, async (req, res) => {
  try {
    console.log(
      "🔍 Patient active prescriptions request - User ID:",
      req.user._id
    );

    const prescriptions = await Prescription.findActiveForPatient(req.user._id);

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length,
    });
  } catch (error) {
    console.error("Error fetching patient's active prescriptions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active prescriptions",
      error: error.message,
    });
  }
});

// Get a specific prescription (Doctor)
router.get("/:id", authenticateDoctorToken, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      doctorId: req.doctor._id,
    })
      .populate("patientId", "firstName lastName email")
      .populate("doctorId", "name email");

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    res.json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    console.error("Error fetching prescription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescription",
      error: error.message,
    });
  }
});

// Update prescription status (Doctor only)
router.patch("/:id/status", authenticateDoctorToken, async (req, res) => {
  try {
    const { status } = req.body;
    const prescriptionId = req.params.id;

    if (!["active", "expired", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      doctorId: req.doctor._id,
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    prescription.status = status;
    await prescription.save();

    res.json({
      success: true,
      message: "Prescription status updated successfully",
      prescription,
    });
  } catch (error) {
    console.error("Error updating prescription status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update prescription status",
      error: error.message,
    });
  }
});

// Delete prescription (Doctor only)
router.delete("/:id", authenticateDoctorToken, async (req, res) => {
  try {
    const prescriptionId = req.params.id;

    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      doctorId: req.doctor._id,
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    // Delete file from S3
    await deletePrescription(prescription.pdfKey);

    // Delete prescription from database
    await Prescription.findByIdAndDelete(prescriptionId);

    res.json({
      success: true,
      message: "Prescription deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting prescription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete prescription",
      error: error.message,
    });
  }
});

module.exports = router;
