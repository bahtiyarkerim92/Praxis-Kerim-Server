const mongoose = require("mongoose");

// Document schema for medical documents with multiple categories
const documentSchema = new mongoose.Schema(
  {
    // Patient reference
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Doctor who uploaded the document (optional for patient uploads)
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: false,
      index: true,
    },

    // Document category
    category: {
      type: String,
      required: true,
      enum: [
        "medical-reports",
        "lab-results",
        "radiology-reports",
        "insurance-documents",
      ],
      index: true,
    },

    // Document title/name
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // Document description or notes
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // File information
    filename: {
      type: String,
      required: true,
    },

    originalFilename: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    contentType: {
      type: String,
      required: true,
    },

    // S3 storage information
    s3Key: {
      type: String,
      required: true,
      unique: true,
    },

    s3Bucket: {
      type: String,
      required: true,
    },

    // Document date (when the document was created, not uploaded)
    documentDate: {
      type: Date,
      default: Date.now,
    },

    // Document metadata for different categories
    metadata: {
      // For lab results
      labName: {
        type: String,
        trim: true,
      },

      testType: {
        type: String,
        trim: true,
      },

      // For radiology reports
      radiologyCenter: {
        type: String,
        trim: true,
      },

      examType: {
        type: String,
        trim: true,
      },

      // For insurance documents
      insuranceProvider: {
        type: String,
        trim: true,
      },

      claimNumber: {
        type: String,
        trim: true,
      },

      // For medical reports
      reportType: {
        type: String,
        trim: true,
      },

      diagnosis: {
        type: String,
        trim: true,
      },

      // Multiple diagnoses support
      diagnoses: [
        {
          type: String,
          trim: true,
        },
      ],

      // Common metadata
      referenceNumber: {
        type: String,
        trim: true,
      },

      priority: {
        type: String,
        enum: ["low", "normal", "high", "urgent"],
        default: "normal",
      },

      // Additional notes
      notes: {
        type: String,
        trim: true,
        maxlength: 500,
      },

      // New radiology-specific fields
      radiologyPhotosLink: {
        type: String,
        trim: true,
      },

      refId: {
        type: String,
        trim: true,
      },

      // Insurance policy number
      policyNumber: {
        type: String,
        trim: true,
      },
    },

    // Security settings for patient uploads
    security: {
      type: {
        type: String,
        enum: ["none", "password", "date"],
        default: "none",
      },
      password: {
        type: String,
      },
      accessUntilDate: {
        type: Date,
      },
    },

    // Who uploaded the document
    uploadedBy: {
      type: String,
      enum: ["doctor", "patient"],
      default: "doctor",
      index: true,
    },

    // Document status
    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
      index: true,
    },

    // Tags for better organization
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // Visibility settings
    visibility: {
      type: String,
      enum: ["patient", "doctor", "both"],
      default: "both",
    },

    // Document expiration (if applicable)
    expiresAt: {
      type: Date,
    },

    // Access tracking
    lastAccessed: {
      type: Date,
      default: Date.now,
    },

    accessCount: {
      type: Number,
      default: 0,
    },

    // Version control
    version: {
      type: Number,
      default: 1,
    },

    // Related documents
    relatedDocuments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],

    // Upload information
    uploadedAt: {
      type: Date,
      default: Date.now,
    },

    // Soft delete
    deletedAt: {
      type: Date,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
documentSchema.index({ patient: 1, category: 1 });
documentSchema.index({ doctor: 1, category: 1 });
documentSchema.index({ patient: 1, status: 1 });
documentSchema.index({ patient: 1, uploadedBy: 1 });
documentSchema.index({ patient: 1, category: 1, uploadedBy: 1 });
documentSchema.index({ documentDate: -1 });
documentSchema.index({ uploadedAt: -1 });
documentSchema.index({ "metadata.priority": 1 });

// Text search index
documentSchema.index({
  title: "text",
  description: "text",
  "metadata.diagnosis": "text",
  "metadata.diagnoses": "text",
  "metadata.testType": "text",
  "metadata.examType": "text",
  "metadata.reportType": "text",
  "metadata.referenceNumber": "text",
});

// Virtual for human-readable category name
documentSchema.virtual("categoryDisplayName").get(function () {
  const categoryNames = {
    "medical-reports": "Medical Reports",
    "lab-results": "Lab Results",
    "radiology-reports": "Radiology Reports",
    "insurance-documents": "Insurance Documents",
  };
  return categoryNames[this.category] || this.category;
});

// Virtual for file extension
documentSchema.virtual("fileExtension").get(function () {
  return this.originalFilename.split(".").pop().toLowerCase();
});

// Virtual for formatted file size
documentSchema.virtual("formattedFileSize").get(function () {
  const bytes = this.fileSize;
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
});

// Virtual for age of document
documentSchema.virtual("documentAge").get(function () {
  return Math.floor((Date.now() - this.documentDate) / (1000 * 60 * 60 * 24));
});

// Method to increment access count
documentSchema.methods.recordAccess = function () {
  this.accessCount += 1;
  this.lastAccessed = new Date();
  return this.save();
};

// Method to soft delete
documentSchema.methods.softDelete = function (deletedBy) {
  this.status = "deleted";
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Method to restore from soft delete
documentSchema.methods.restore = function () {
  this.status = "active";
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

// Method to archive document
documentSchema.methods.archive = function () {
  this.status = "archived";
  return this.save();
};

// Method to get category-specific metadata
documentSchema.methods.getCategoryMetadata = function () {
  const metadata = this.metadata || {};

  switch (this.category) {
    case "lab-results":
      return {
        labName: metadata.labName,
        testType: metadata.testType,
        referenceNumber: metadata.referenceNumber,
        priority: metadata.priority,
        notes: metadata.notes,
      };

    case "radiology-reports":
      return {
        radiologyCenter: metadata.radiologyCenter,
        examType: metadata.examType,
        referenceNumber: metadata.referenceNumber,
        priority: metadata.priority,
        notes: metadata.notes,
      };

    case "insurance-documents":
      return {
        insuranceProvider: metadata.insuranceProvider,
        claimNumber: metadata.claimNumber,
        referenceNumber: metadata.referenceNumber,
        priority: metadata.priority,
        notes: metadata.notes,
      };

    case "medical-reports":
      return {
        reportType: metadata.reportType,
        diagnosis: metadata.diagnosis,
        referenceNumber: metadata.referenceNumber,
        priority: metadata.priority,
        notes: metadata.notes,
      };

    default:
      return metadata;
  }
};

// Static method to get documents by category
documentSchema.statics.getByCategory = function (
  patientId,
  category,
  options = {}
) {
  const query = {
    patient: patientId,
    category: category,
    status: { $ne: "deleted" },
  };

  return this.find(query)
    .populate("doctor", "firstName lastName specialization")
    .sort({ documentDate: -1, uploadedAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// Static method to get recent documents
documentSchema.statics.getRecent = function (patientId, limit = 10) {
  return this.find({
    patient: patientId,
    status: { $ne: "deleted" },
  })
    .populate("doctor", "firstName lastName specialization")
    .sort({ uploadedAt: -1 })
    .limit(limit);
};

// Static method to search documents
documentSchema.statics.searchDocuments = function (
  patientId,
  searchTerm,
  options = {}
) {
  const query = {
    patient: patientId,
    status: { $ne: "deleted" },
    $text: { $search: searchTerm },
  };

  if (options.category) {
    query.category = options.category;
  }

  return this.find(query)
    .populate("doctor", "firstName lastName specialization")
    .sort({ score: { $meta: "textScore" }, uploadedAt: -1 })
    .limit(options.limit || 20);
};

// Pre-save middleware to validate category-specific metadata
documentSchema.pre("save", function (next) {
  if (this.isModified("metadata") || this.isNew) {
    const metadata = this.metadata || {};

    // Validate category-specific required fields
    switch (this.category) {
      case "lab-results":
        if (!metadata.testType && !this.title.includes("Lab")) {
          this.title = `Lab Result - ${this.title}`;
        }
        break;

      case "radiology-reports":
        if (!metadata.examType && !this.title.includes("Radiology")) {
          this.title = `Radiology Report - ${this.title}`;
        }
        break;

      case "insurance-documents":
        if (!this.title.includes("Insurance")) {
          this.title = `Insurance Document - ${this.title}`;
        }
        break;

      case "medical-reports":
        if (!metadata.reportType && !this.title.includes("Medical")) {
          this.title = `Medical Report - ${this.title}`;
        }
        break;
    }
  }

  next();
});

// Export the model
module.exports = mongoose.model("Document", documentSchema);
