const express = require("express");
const router = express.Router();
const multer = require("multer");
const Document = require("../models/Document");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const {
  uploadDocument,
  generatePresignedUrl,
  deleteDocument,
} = require("../services/aws/documentUpload");
const { authenticateToken } = require("../middleware/auth");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");

// Configure multer for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all common file types for documents
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/rtf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/bmp",
      "image/tiff",
      "image/webp",
      "image/svg+xml",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/dicom",
      "application/xml",
      "application/json",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"), false);
    }
  },
}).single("document");

/**
 * Upload a document (Doctor only)
 */
const uploadDocumentFile = async (req, res) => {
  try {
    // Use multer middleware
    upload(req, res, async (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({
          success: false,
          message: err.message || "File upload error",
        });
      }

      try {
        const { patientId, category, title, description, metadata } = req.body;
        const doctorId = req.doctor._id;

        // Validate required fields
        if (!patientId || !category || !title) {
          return res.status(400).json({
            success: false,
            message: "Patient ID, category, and title are required",
          });
        }

        // Validate file
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Document file is required",
          });
        }

        // Validate category
        const validCategories = [
          "medical-reports",
          "lab-results",
          "radiology-reports",
          "insurance-documents",
        ];
        if (!validCategories.includes(category)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid category. Must be one of: " + validCategories.join(", "),
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

        // Verify doctor exists
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
          return res.status(404).json({
            success: false,
            message: "Doctor not found",
          });
        }

        // Upload file to S3
        const uploadResult = await uploadDocument(
          patientId,
          category,
          req.file
        );

        if (!uploadResult.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to upload document to storage",
            error: uploadResult.error,
          });
        }

        // Parse metadata if provided
        let parsedMetadata = {};
        if (metadata) {
          try {
            parsedMetadata =
              typeof metadata === "string" ? JSON.parse(metadata) : metadata;
          } catch (e) {
            console.error("Error parsing metadata:", e);
          }
        }

        // Handle multiple diagnoses in metadata
        if (parsedMetadata.diagnoses) {
          // Parse diagnoses if provided as string
          if (typeof parsedMetadata.diagnoses === "string") {
            try {
              parsedMetadata.diagnoses = JSON.parse(parsedMetadata.diagnoses);
            } catch (e) {
              console.error("Error parsing diagnoses:", e);
            }
          }
        } else if (parsedMetadata.diagnosis) {
          // Backward compatibility: convert single diagnosis to array
          parsedMetadata.diagnoses = [parsedMetadata.diagnosis];
        }

        // Create document record in database
        const document = new Document({
          patient: patientId,
          doctor: doctorId,
          category: category,
          title: title,
          description: description || "",
          filename: uploadResult.data.filename,
          originalFilename: uploadResult.data.originalFilename,
          fileSize: uploadResult.data.fileSize,
          contentType: uploadResult.data.contentType,
          s3Key: uploadResult.data.key,
          s3Bucket: uploadResult.data.bucket,
          documentDate: parsedMetadata.documentDate || new Date(),
          metadata: parsedMetadata,
          uploadedAt: new Date(),
        });

        await document.save();

        // Populate doctor information for response
        await document.populate("doctor", "firstName lastName specialization");

        res.status(201).json({
          success: true,
          message: "Document uploaded successfully",
          data: {
            document: document,
            uploadDetails: {
              fileSize: uploadResult.data.fileSize,
              contentType: uploadResult.data.contentType,
              uploadTimestamp: uploadResult.data.uploadTimestamp,
            },
          },
        });
      } catch (error) {
        console.error("Document upload error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to upload document",
          error: error.message,
        });
      }
    });
  } catch (error) {
    console.error("Upload endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get documents for a patient (Doctor side)
 */
const getPatientDocuments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { category, page = 1, limit = 20, search } = req.query;

    // Verify patient exists
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Build query
    const query = {
      patient: patientId,
      status: { $ne: "deleted" },
    };

    if (category) {
      query.category = category;
    }

    // Handle search
    let documents;
    if (search) {
      documents = await Document.searchDocuments(patientId, search, {
        category: category,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      });
    } else {
      documents = await Document.find(query)
        .populate("doctor", "firstName lastName specialization")
        .sort({ documentDate: -1, uploadedAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
    }

    // Get total count
    const total = await Document.countDocuments(query);

    // Get statistics by category
    const stats = await Document.aggregate([
      {
        $match: {
          patient: patient._id,
          status: { $ne: "deleted" },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryStats = {};
    stats.forEach((stat) => {
      categoryStats[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: {
        documents: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        statistics: categoryStats,
        patient: {
          id: patient._id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
        },
      },
    });
  } catch (error) {
    console.error("Get patient documents error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve documents",
      error: error.message,
    });
  }
};

/**
 * Get documents for the current patient (Patient side)
 */
const getMyDocuments = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { category, page = 1, limit = 20, search } = req.query;

    // Build query
    const query = {
      patient: patientId,
      status: { $ne: "deleted" },
      visibility: { $in: ["patient", "both"] },
    };

    if (category) {
      query.category = category;
    }

    // Handle search
    let documents;
    if (search) {
      documents = await Document.searchDocuments(patientId, search, {
        category: category,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      });
    } else {
      documents = await Document.find(query)
        .populate("doctor", "firstName lastName specialization")
        .sort({ documentDate: -1, uploadedAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
    }

    // Get total count
    const total = await Document.countDocuments(query);

    // Get statistics by category
    const stats = await Document.aggregate([
      {
        $match: {
          patient: req.user._id,
          status: { $ne: "deleted" },
          visibility: { $in: ["patient", "both"] },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryStats = {};
    stats.forEach((stat) => {
      categoryStats[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: {
        documents: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        statistics: categoryStats,
      },
    });
  } catch (error) {
    console.error("Get my documents error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve documents",
      error: error.message,
    });
  }
};

/**
 * Get a specific document by ID with presigned URL (Doctor side)
 */
const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doctorId = req.doctor._id;

    // Find document
    const document = await Document.findById(documentId)
      .populate("patient", "firstName lastName email")
      .populate("doctor", "firstName lastName specialization");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if doctor has access to this document
    // For patient uploads (doctor is null), check if the document is visible to doctors
    if (document.doctor) {
      // Doctor-uploaded document - check if this doctor owns it
      console.log("Doctor access check:", {
        documentDoctorId: document.doctor._id.toString(),
        requestDoctorId: doctorId.toString(),
        match: document.doctor._id.toString() === doctorId.toString(),
      });

      if (document.doctor._id.toString() !== doctorId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    } else {
      // Patient-uploaded document - check if visible to doctors
      console.log("Patient upload access check:", {
        documentId: document._id,
        visibility: document.visibility,
        uploadedBy: document.uploadedBy,
        doctorId: doctorId.toString(),
      });

      if (!["doctor", "both"].includes(document.visibility)) {
        return res.status(403).json({
          success: false,
          message: "Access denied - document not visible to doctors",
        });
      }
    }

    // Generate presigned URL for file access
    console.log("Generating presigned URL for document:", {
      documentId: document._id,
      s3Key: document.s3Key,
      s3Bucket: document.s3Bucket,
      originalFilename: document.originalFilename,
    });

    const presignedUrl = await generatePresignedUrl(document.s3Key, 3600); // 1 hour expiry

    // Record access
    await document.recordAccess();

    res.status(200).json({
      success: true,
      data: {
        document: document,
        presignedUrl: presignedUrl,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error("Get document error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve document",
      error: error.message,
    });
  }
};

/**
 * Upload document by patient
 */
const patientUploadDocument = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({
          success: false,
          message: err.message || "File upload error",
        });
      }

      try {
        // Debug logging
        console.log("=== Patient Upload Debug ===");
        console.log("Request body:", req.body);
        console.log(
          "Request file:",
          req.file
            ? {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
              }
            : null
        );
        console.log("Request headers:", req.headers);

        const {
          category,
          title,
          description,
          securityType,
          securityPassword,
          securityDate,
          metadata,
        } = req.body;
        const patientId = req.user.id;

        console.log("Extracted fields:", {
          category,
          title,
          description,
          securityType,
          patientId,
        });

        // Validate required fields
        if (!category || !title) {
          return res.status(400).json({
            success: false,
            message: "Category and title are required",
          });
        }

        // Validate file
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Document file is required",
          });
        }

        // Validate category
        const validCategories = [
          "medical-reports",
          "lab-results",
          "radiology-reports",
          "insurance-documents",
        ];
        if (!validCategories.includes(category)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid category. Must be one of: " + validCategories.join(", "),
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

        // Upload file to S3
        const uploadResult = await uploadDocument(
          patientId,
          category,
          req.file
        );

        if (!uploadResult.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to upload document to storage",
            error: uploadResult.error,
          });
        }

        // Parse metadata if provided
        let parsedMetadata = {};
        if (metadata) {
          try {
            parsedMetadata =
              typeof metadata === "string" ? JSON.parse(metadata) : metadata;
          } catch (e) {
            console.error("Error parsing metadata:", e);
          }
        }

        // Handle security settings
        const securitySettings = {
          type: securityType || "none",
          password: securityType === "password" ? securityPassword : undefined,
          accessUntilDate:
            securityType === "date" ? new Date(securityDate) : undefined,
        };

        // Create document record in database
        console.log("=== PATIENT DOCUMENT UPLOAD - Creating DB Record ===");
        console.log("Upload result data:", {
          filename: uploadResult.data.filename,
          originalFilename: uploadResult.data.originalFilename,
          key: uploadResult.data.key,
          bucket: uploadResult.data.bucket,
          fileSize: uploadResult.data.fileSize,
          contentType: uploadResult.data.contentType,
        });

        const document = new Document({
          patient: patientId,
          doctor: null, // Patient upload, no doctor associated
          category: category,
          title: title,
          description: description || "",
          filename: uploadResult.data.filename,
          originalFilename: uploadResult.data.originalFilename,
          fileSize: uploadResult.data.fileSize,
          contentType: uploadResult.data.contentType,
          s3Key: uploadResult.data.key,
          s3Bucket: uploadResult.data.bucket,
          documentDate: parsedMetadata.documentDate || new Date(),
          metadata: parsedMetadata,
          security: securitySettings,
          uploadedBy: "patient",
          visibility: "both", // Patient uploads are visible to both patient and doctors
          uploadedAt: new Date(),
        });

        await document.save();

        console.log("Document saved to database:", {
          _id: document._id,
          title: document.title,
          category: document.category,
          s3Key: document.s3Key,
          s3Bucket: document.s3Bucket,
          uploadedBy: document.uploadedBy,
          originalFilename: document.originalFilename,
        });

        res.status(201).json({
          success: true,
          message: "Document uploaded successfully",
          data: {
            document: document,
            uploadDetails: {
              fileSize: uploadResult.data.fileSize,
              contentType: uploadResult.data.contentType,
              uploadTimestamp: uploadResult.data.uploadTimestamp,
            },
          },
        });
      } catch (error) {
        console.error("Patient document upload error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to upload document",
          error: error.message,
        });
      }
    });
  } catch (error) {
    console.error("Patient upload endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get received documents (uploaded by doctors) for current patient
 */
const getReceivedDocuments = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { category, page = 1, limit = 20 } = req.query;

    // Build query for documents uploaded by doctors for this patient
    const query = {
      patient: patientId,
      status: { $ne: "deleted" },
      uploadedBy: "doctor",
      visibility: { $in: ["patient", "both"] },
    };

    if (category) {
      query.category = category;
    }

    const documents = await Document.find(query)
      .populate("doctor", "firstName lastName specialization")
      .sort({ documentDate: -1, uploadedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Document.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        documents: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get received documents error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve received documents",
      error: error.message,
    });
  }
};

/**
 * Get uploaded documents (uploaded by current patient)
 */
const getUploadedDocuments = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { category, page = 1, limit = 20 } = req.query;

    // Build query for documents uploaded by this patient
    const query = {
      patient: patientId,
      status: { $ne: "deleted" },
      uploadedBy: "patient",
    };

    if (category) {
      query.category = category;
    }

    const documents = await Document.find(query)
      .sort({ documentDate: -1, uploadedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Document.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        documents: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get uploaded documents error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve uploaded documents",
      error: error.message,
    });
  }
};

/**
 * Get patient uploads for doctor dashboard (Doctor side - to see what patients uploaded)
 */
const getPatientUploads = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { category, page = 1, limit = 20 } = req.query;

    // Verify patient exists
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Build query for documents uploaded by the patient
    const query = {
      patient: patientId,
      status: { $ne: "deleted" },
      uploadedBy: "patient",
    };

    if (category) {
      query.category = category;
    }

    const documents = await Document.find(query)
      .sort({ documentDate: -1, uploadedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Document.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        documents: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        patient: {
          id: patient._id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
        },
      },
    });
  } catch (error) {
    console.error("Get patient uploads error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve patient uploads",
      error: error.message,
    });
  }
};

/**
 * View document with security check (Patient side)
 */
const viewSecureDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { password } = req.body;
    const patientId = req.user.id;

    // Find document
    const document = await Document.findById(documentId).populate(
      "doctor",
      "firstName lastName specialization"
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if patient has access to this document
    if (document.patient.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check security settings
    if (document.security && document.security.type !== "none") {
      if (document.security.type === "password") {
        if (!password || password !== document.security.password) {
          return res.status(401).json({
            success: false,
            message: "Invalid password",
            requiresPassword: true,
          });
        }
      } else if (document.security.type === "date") {
        const now = new Date();
        if (now > document.security.accessUntilDate) {
          return res.status(403).json({
            success: false,
            message: "Document access has expired",
          });
        }
      }
    }

    // Generate presigned URL for file access
    const presignedUrl = await generatePresignedUrl(document.s3Key, 3600);

    // Record access
    await document.recordAccess();

    res.status(200).json({
      success: true,
      presignedUrl: presignedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("View secure document error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to access document",
      error: error.message,
    });
  }
};

/**
 * Get a specific document by ID with presigned URL (Patient side)
 */
const getMyDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;
    const patientId = req.user.id;

    // Debug logging
    console.log("=== getMyDocumentById DEBUG ===");
    console.log("Document ID requested:", documentId);
    console.log("Patient ID:", patientId);

    // Find document
    const document = await Document.findById(documentId).populate(
      "doctor",
      "firstName lastName specialization"
    );

    if (!document) {
      console.log("Document not found in database");
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Debug: Log full document details
    console.log("Found document:", {
      _id: document._id,
      title: document.title,
      category: document.category,
      uploadedBy: document.uploadedBy,
      patient: document.patient,
      doctor: document.doctor,
      s3Key: document.s3Key,
      s3Bucket: document.s3Bucket,
      originalFilename: document.originalFilename,
      contentType: document.contentType,
      fileSize: document.fileSize,
      visibility: document.visibility,
    });

    // Check if patient owns this document and has visibility
    if (
      document.patient.toString() !== patientId ||
      !["patient", "both"].includes(document.visibility)
    ) {
      console.log("Access denied:", {
        documentPatient: document.patient.toString(),
        requestPatient: patientId,
        visibility: document.visibility,
      });
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Generate presigned URL for file access
    console.log("Generating presigned URL for patient document:", {
      documentId: document._id,
      s3Key: document.s3Key,
      s3Bucket: document.s3Bucket,
      originalFilename: document.originalFilename,
      category: document.category,
      uploadedBy: document.uploadedBy,
    });

    const presignedUrl = await generatePresignedUrl(document.s3Key, 3600); // 1 hour expiry

    console.log(
      "Generated presigned URL:",
      presignedUrl.substring(0, 100) + "..."
    );

    // Record access
    await document.recordAccess();

    res.status(200).json({
      success: true,
      data: {
        document: document,
        presignedUrl: presignedUrl,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error("Get my document error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve document",
      error: error.message,
    });
  }
};

/**
 * Update document metadata (Doctor only)
 */
const updateDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doctorId = req.doctor._id;
    const { title, description, metadata, documentDate, visibility, status } =
      req.body;

    // Find document
    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if doctor has access to this document
    if (document.doctor.toString() !== doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Update fields
    if (title) document.title = title;
    if (description !== undefined) document.description = description;
    if (metadata) document.metadata = { ...document.metadata, ...metadata };
    if (documentDate) document.documentDate = documentDate;
    if (visibility) document.visibility = visibility;
    if (status) document.status = status;

    await document.save();

    // Populate for response
    await document.populate("doctor", "firstName lastName specialization");
    await document.populate("patient", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Document updated successfully",
      data: {
        document: document,
      },
    });
  } catch (error) {
    console.error("Update document error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update document",
      error: error.message,
    });
  }
};

/**
 * Delete document (Doctor only)
 */
const deleteDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doctorId = req.doctor._id;

    // Find document
    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if doctor has access to this document
    if (document.doctor.toString() !== doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Soft delete the document
    await document.softDelete(doctorId);

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: error.message,
    });
  }
};

/**
 * Get document categories and their statistics
 */
const getDocumentCategories = async (req, res) => {
  try {
    const { patientId } = req.params;
    const isPatient = req.user.role === "patient";

    let query = {};
    if (isPatient) {
      query = {
        patient: req.user.id,
        status: { $ne: "deleted" },
        visibility: { $in: ["patient", "both"] },
      };
    } else {
      query = {
        patient: patientId,
        status: { $ne: "deleted" },
      };
    }

    const categories = await Document.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          lastUpdated: { $max: "$uploadedAt" },
        },
      },
    ]);

    const categoryList = [
      {
        key: "medical-reports",
        name: "Medical Reports",
        count: 0,
        lastUpdated: null,
      },
      { key: "lab-results", name: "Lab Results", count: 0, lastUpdated: null },
      {
        key: "radiology-reports",
        name: "Radiology Reports",
        count: 0,
        lastUpdated: null,
      },
      {
        key: "insurance-documents",
        name: "Insurance Documents",
        count: 0,
        lastUpdated: null,
      },
    ];

    categories.forEach((cat) => {
      const category = categoryList.find((c) => c.key === cat._id);
      if (category) {
        category.count = cat.count;
        category.lastUpdated = cat.lastUpdated;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        categories: categoryList,
        totalDocuments: categories.reduce((sum, cat) => sum + cat.count, 0),
      },
    });
  } catch (error) {
    console.error("Get document categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve document categories",
      error: error.message,
    });
  }
};

// Router routes
// Doctor routes
router.post("/upload", authenticateDoctorToken, uploadDocumentFile);
router.get("/patient/:patientId", authenticateDoctorToken, getPatientDocuments);
router.get(
  "/patient/:patientId/uploads",
  authenticateDoctorToken,
  getPatientUploads
);
router.get("/doctor/:documentId", authenticateDoctorToken, getDocumentById);
router.put("/:documentId", authenticateDoctorToken, updateDocument);
router.delete("/:documentId", authenticateDoctorToken, deleteDocumentById);
router.get(
  "/categories/:patientId",
  authenticateDoctorToken,
  getDocumentCategories
);

// Patient routes
router.post("/patient-upload", authenticateToken, patientUploadDocument);
router.get("/received", authenticateToken, getReceivedDocuments);
router.get("/uploaded", authenticateToken, getUploadedDocuments);
router.post("/view/:documentId", authenticateToken, viewSecureDocument);
router.get("/my-documents", authenticateToken, getMyDocuments);
router.get("/my-documents/:documentId", authenticateToken, getMyDocumentById);
router.get("/my-categories", authenticateToken, getDocumentCategories);

module.exports = router;
