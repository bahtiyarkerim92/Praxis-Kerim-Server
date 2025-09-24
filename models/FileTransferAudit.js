/**
 * File Transfer Audit Model
 * Tracks minimal metadata for file transfers during video meetings
 * Compliant with BG/DE privacy regulations
 *
 * Features:
 * - TTL index for automatic deletion after 90 days
 * - Minimal metadata only (no file content)
 * - Pseudonymized IDs for privacy
 * - Encrypted at rest via MongoDB configuration
 */

const mongoose = require("mongoose");

const FileTransferAuditSchema = new mongoose.Schema(
  {
    // Meeting identifier (not sensitive)
    meetingId: {
      type: String,
      required: true,
      index: true,
      maxlength: 255,
    },

    // Pseudonymized user identifiers (internal IDs, not personal data)
    senderId: {
      type: String,
      required: true,
      maxlength: 255,
    },

    receiverId: {
      type: String,
      required: true,
      maxlength: 255,
    },

    // Generic filename (medical terms removed via sanitization)
    fileName: {
      type: String,
      required: true,
      maxlength: 255,
    },

    // File size in bytes
    fileSize: {
      type: Number,
      required: true,
      min: 0,
      max: 104857600, // 100MB max
    },

    // Transfer status
    status: {
      type: String,
      required: true,
      enum: ["sent", "received", "failed"],
      index: true,
    },

    // Transfer timestamp
    sentAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    // Transfer method for debugging
    method: {
      type: String,
      enum: ["p2p", "fallback"],
      default: "p2p",
    },

    // Optional error message (for failed transfers)
    errorMessage: {
      type: String,
      maxlength: 500,
    },
  },
  {
    // Disable versioning for performance
    versionKey: false,

    // Add timestamps for created/updated
    timestamps: false, // We use sentAt instead
  }
);

// TTL Index - automatically delete documents after 90 days (7,776,000 seconds)
FileTransferAuditSchema.index(
  { sentAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Compound index for efficient queries
FileTransferAuditSchema.index({ meetingId: 1, sentAt: -1 });
FileTransferAuditSchema.index({ senderId: 1, sentAt: -1 });

// Static method to log a file transfer
FileTransferAuditSchema.statics.logTransfer = async function (transferData) {
  try {
    const audit = new this({
      meetingId: transferData.meetingId,
      senderId: transferData.senderId,
      receiverId: transferData.receiverId,
      fileName: sanitizeFileName(transferData.fileName),
      fileSize: transferData.fileSize,
      status: transferData.status,
      method: transferData.method || "p2p",
      errorMessage: transferData.errorMessage,
      sentAt: transferData.sentAt || new Date(),
    });

    await audit.save();
    return audit;
  } catch (error) {
    console.error("Failed to log file transfer audit:", error);
    // Don't throw - audit logging is best effort
    return null;
  }
};

// Static method to get transfer statistics (anonymized)
FileTransferAuditSchema.statics.getStats = async function (dateRange) {
  try {
    const pipeline = [
      {
        $match: {
          sentAt: {
            $gte: dateRange.from,
            $lte: dateRange.to,
          },
        },
      },
      {
        $group: {
          _id: {
            status: "$status",
            method: "$method",
          },
          count: { $sum: 1 },
          totalSize: { $sum: "$fileSize" },
          avgSize: { $avg: "$fileSize" },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id.status",
          method: "$_id.method",
          count: 1,
          totalSize: 1,
          avgSize: { $round: ["$avgSize", 0] },
        },
      },
    ];

    return await this.aggregate(pipeline);
  } catch (error) {
    console.error("Failed to get file transfer stats:", error);
    return [];
  }
};

// Static method to clean up old records (manual cleanup if TTL fails)
FileTransferAuditSchema.statics.cleanupOldRecords = async function () {
  try {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.deleteMany({ sentAt: { $lt: cutoffDate } });
    console.log(
      `Cleaned up ${result.deletedCount} old file transfer audit records`
    );
    return result.deletedCount;
  } catch (error) {
    console.error("Failed to cleanup old file transfer audit records:", error);
    return 0;
  }
};

/**
 * Sanitize filename to remove medical terms and sensitive information
 * This ensures GDPR compliance by removing potential medical data
 */
function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== "string") {
    return "document";
  }

  // Get file extension
  const lastDotIndex = fileName.lastIndexOf(".");
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";

  // Medical terms that should be removed/replaced
  const medicalTerms = [
    /\b(patient|diagnosis|prescription|medical|health|symptom|treatment|therapy|medication|drug|disease|illness|condition|report|result|test|exam|consultation|visit|appointment)\b/gi,
    /\b(blood|urine|x-ray|mri|ct|scan|ultrasound|biopsy|lab|laboratory)\b/gi,
    /\b(covid|diabetes|cancer|heart|cardiac|respiratory|mental|psychiatric)\b/gi,
    /\b(dr\.|doctor|physician|nurse|clinic|hospital|medical center)\b/gi,
  ];

  let sanitized = fileName;

  // Remove medical terms
  medicalTerms.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "doc");
  });

  // Remove personal identifiers (common patterns)
  sanitized = sanitized.replace(/\b\d{10,}\b/g, "XXXXXX"); // Long numbers (could be IDs)
  sanitized = sanitized.replace(/\b[A-Z]{2,}\d{2,}\b/g, "XXXXXX"); // Codes like AB123

  // Clean up multiple spaces and special chars
  sanitized = sanitized.replace(/[^\w\-_.]/g, "_");
  sanitized = sanitized.replace(/_{2,}/g, "_");
  sanitized = sanitized.replace(/^_+|_+$/g, "");

  // If nothing left, use generic name
  if (!sanitized || sanitized.length < 2) {
    sanitized = "document";
  }

  // Limit length
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50);
  }

  return sanitized + extension;
}

const FileTransferAudit = mongoose.model(
  "FileTransferAudit",
  FileTransferAuditSchema
);

module.exports = FileTransferAudit;
