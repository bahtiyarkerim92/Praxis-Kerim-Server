const express = require("express");
const router = express.Router();
const SickNote = require("../models/SickNote");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const { uploadSingle } = require("../services/aws/pdfUpload");
const {
  uploadSickNote,
  generatePresignedUrl,
  deleteSickNote,
} = require("../services/aws/sickNoteUpload");
const { authenticateToken } = require("../middleware/auth");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");

// Upload sick note PDF (Doctor only)
router.post("/upload", authenticateDoctorToken, (req, res) => {
  console.log("Sick note upload attempt - Doctor:", req.doctor?._id);

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
        description,
        validFrom,
        validTo,
        diagnosis,
        diagnoses,
        restrictions,
      } = req.body;

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

      // Validate required fields
      if (
        !patientId ||
        !title ||
        !validFrom ||
        !validTo ||
        (parsedDiagnoses.length === 0 && !diagnosis)
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
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
      const uploadResult = await uploadSickNote(patientId, req.file);

      if (!uploadResult.success) {
        return res.status(400).json({
          success: false,
          message: uploadResult.error.message,
          error: uploadResult.error,
        });
      }

      // Create sick note record
      const sickNote = new SickNote({
        patientId,
        doctorId: req.doctor._id,
        title,
        description,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        diagnosis:
          parsedDiagnoses.length === 1 ? parsedDiagnoses[0] : undefined, // For backward compatibility
        diagnoses: parsedDiagnoses.length > 0 ? parsedDiagnoses : undefined,
        restrictions,
        pdfUrl: uploadResult.data.fileUrl,
        pdfKey: uploadResult.data.key,
        originalFileName: uploadResult.data.originalFilename,
        fileSize: uploadResult.data.fileSize,
      });

      await sickNote.save();

      // Populate doctor and patient info for response
      await sickNote.populate("doctorId", "name email");
      await sickNote.populate("patientId", "firstName lastName email");

      console.log("Sick note created successfully:", sickNote._id);

      res.json({
        success: true,
        message: "Sick note uploaded successfully",
        sickNote,
        uploadData: uploadResult.data,
      });
    } catch (uploadError) {
      console.error("Sick note upload error:", uploadError);
      res.status(500).json({
        success: false,
        message: "Failed to upload sick note",
        error: uploadError.message,
      });
    }
  });
});

// Get presigned URL for viewing a sick note PDF (Doctor only)
router.get("/:id/pdf", authenticateDoctorToken, async (req, res) => {
  try {
    const sickNoteId = req.params.id;

    // Find the sick note and verify doctor has access
    const sickNote = await SickNote.findOne({
      _id: sickNoteId,
      doctorId: req.doctor._id,
    });

    if (!sickNote) {
      return res.status(404).json({
        success: false,
        message: "Sick note not found or access denied",
      });
    }

    // Generate presigned URL for secure access
    const presignedUrl = await generatePresignedUrl(sickNote.pdfKey, 3600); // 1 hour expiry

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

// Get presigned URL for viewing a sick note PDF (Patient only)
router.get("/:id/patient-pdf", authenticateToken, async (req, res) => {
  try {
    const sickNoteId = req.params.id;

    // Find the sick note and verify patient has access
    const sickNote = await SickNote.findOne({
      _id: sickNoteId,
      patientId: req.user._id,
    });

    if (!sickNote) {
      return res.status(404).json({
        success: false,
        message: "Sick note not found or access denied",
      });
    }

    // Generate presigned URL for secure access
    const presignedUrl = await generatePresignedUrl(sickNote.pdfKey, 3600); // 1 hour expiry

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

// Get all sick notes for a doctor
router.get("/doctor", authenticateDoctorToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, patientId, status } = req.query;

    const filter = { doctorId: req.doctor._id };

    if (patientId) {
      filter.patientId = patientId;
    }

    if (status) {
      filter.status = status;
    }

    const sickNotes = await SickNote.find(filter)
      .populate("patientId", "firstName lastName email")
      .populate("doctorId", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SickNote.countDocuments(filter);

    res.json({
      success: true,
      data: sickNotes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching doctor's sick notes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sick notes",
      error: error.message,
    });
  }
});

// Get all sick notes for a patient
router.get("/patient", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    console.log("🔍 Patient sick notes request - User ID:", req.user._id);
    const filter = { patientId: req.user._id };

    if (status) {
      filter.status = status;
    }

    const sickNotes = await SickNote.find(filter)
      .populate("doctorId", "name email specialties")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SickNote.countDocuments(filter);

    console.log("🔍 Found sick notes for patient:", {
      patientId: req.user._id,
      count: sickNotes.length,
      total: total,
    });

    res.json({
      success: true,
      data: sickNotes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching patient's sick notes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sick notes",
      error: error.message,
    });
  }
});

// Get a specific sick note by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const sickNote = await SickNote.findById(req.params.id)
      .populate("doctorId", "name email specialties")
      .populate("patientId", "firstName lastName email");

    if (!sickNote) {
      return res.status(404).json({
        success: false,
        message: "Sick note not found",
      });
    }

    // Check if user has access to this sick note
    const isPatient =
      req.user._id.toString() === sickNote.patientId._id.toString();
    const isDoctor =
      req.doctor && req.doctor._id === sickNote.doctorId._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: sickNote,
    });
  } catch (error) {
    console.error("Error fetching sick note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sick note",
      error: error.message,
    });
  }
});

// Update sick note status (Doctor only)
router.patch("/:id/status", authenticateDoctorToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "expired", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const sickNote = await SickNote.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.doctor._id },
      { status },
      { new: true }
    )
      .populate("doctorId", "name email")
      .populate("patientId", "firstName lastName email");

    if (!sickNote) {
      return res.status(404).json({
        success: false,
        message: "Sick note not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Sick note status updated successfully",
      data: sickNote,
    });
  } catch (error) {
    console.error("Error updating sick note status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sick note status",
      error: error.message,
    });
  }
});

// Delete sick note (Doctor only)
router.delete("/:id", authenticateDoctorToken, async (req, res) => {
  try {
    const sickNote = await SickNote.findOneAndDelete({
      _id: req.params.id,
      doctorId: req.doctor._id,
    });

    if (!sickNote) {
      return res.status(404).json({
        success: false,
        message: "Sick note not found or access denied",
      });
    }

    // Delete from S3
    try {
      const deleteParams = {
        Bucket: bucketName,
        Key: sickNote.pdfKey,
      };

      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);
      console.log("Sick note PDF deleted from S3:", sickNote.pdfKey);
    } catch (s3Error) {
      console.error("Error deleting PDF from S3:", s3Error);
      // Continue even if S3 deletion fails
    }

    res.json({
      success: true,
      message: "Sick note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sick note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sick note",
      error: error.message,
    });
  }
});

module.exports = router;
