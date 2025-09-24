/**
 * File Transfer Audit Logging API Routes
 * Handles minimal metadata logging for compliance
 * Compliant with BG/DE privacy regulations
 *
 * Features:
 * - Minimal metadata logging only
 * - Authentication required
 * - Automatic TTL cleanup (90 days)
 * - Pseudonymized user identifiers
 * - No file content logging
 */

const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { authenticateToken } = require("../../middleware/auth");
const { authenticateDoctorToken } = require("../../middleware/doctorAuth");
const FileTransferAudit = require("../../models/FileTransferAudit");

const router = express.Router();

// Middleware to authenticate either patient or doctor
const authenticateUser = (req, res, next) => {
  // Try doctor auth first
  authenticateDoctorToken(req, res, (err) => {
    if (!err && req.doctor) {
      req.user = {
        id: req.doctor._id.toString(),
        type: "doctor",
        email: req.doctor.email,
      };
      return next();
    }

    // Try patient auth
    authenticateToken(req, res, (err) => {
      if (!err && req.user) {
        req.user = {
          id: req.user.userId,
          type: "patient",
          email: req.user.email,
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    });
  });
};

// Validation middleware
const validateFileTransferLog = [
  body("meetingId")
    .isString()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage("Invalid meeting ID format"),
  body("senderId")
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage("Sender ID is required"),
  body("receiverId")
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage("Receiver ID is required"),
  body("fileName")
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage("File name is required"),
  body("fileSize")
    .isInt({ min: 0, max: 104857600 }) // 100MB max
    .withMessage("Invalid file size"),
  body("status")
    .isIn(["sent", "received", "failed"])
    .withMessage("Invalid status"),
  body("timestamp")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Invalid timestamp"),
  body("method")
    .optional()
    .isIn(["p2p", "fallback"])
    .withMessage("Invalid method"),
  body("errorMessage")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Error message too long"),
];

/**
 * POST /api/audit/file-transfer
 * Log a file transfer event
 */
router.post(
  "/file-transfer",
  authenticateUser,
  validateFileTransferLog,
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        meetingId,
        senderId,
        receiverId,
        fileName,
        fileSize,
        status,
        timestamp,
        method,
        errorMessage,
      } = req.body;

      // Verify that the authenticated user is either sender or receiver
      // Note: In development, we allow logging with placeholder IDs
      const userId = req.user.id;
      const isValidSender =
        userId === senderId ||
        senderId.includes("unknown") ||
        senderId === "unknown-patient" ||
        senderId === "unknown-doctor";
      const isValidReceiver =
        userId === receiverId ||
        receiverId.includes("unknown") ||
        receiverId === "unknown-patient" ||
        receiverId === "unknown-doctor";

      if (!isValidSender && !isValidReceiver) {
        console.warn(
          `Audit log rejected: userId=${userId}, senderId=${senderId}, receiverId=${receiverId}`
        );
        return res.status(403).json({
          success: false,
          message: "Not authorized to log this transfer",
        });
      }

      // Log the transfer (sanitization happens in the model)
      const auditRecord = await FileTransferAudit.logTransfer({
        meetingId,
        senderId,
        receiverId,
        fileName, // Will be sanitized by the model
        fileSize,
        status,
        method: method || "p2p",
        errorMessage,
        sentAt: timestamp ? new Date(timestamp) : new Date(),
      });

      if (!auditRecord) {
        // Logging failed but don't error to client (best effort)
        console.warn("Audit logging failed for file transfer");
      }

      res.json({
        success: true,
        message: "Transfer logged successfully",
        auditId: auditRecord
          ? auditRecord._id.toString().substring(0, 8) + "..."
          : null,
      });
    } catch (error) {
      console.error("File transfer audit error:", error);

      // Don't fail the request even if audit logging fails
      res.json({
        success: true,
        message: "Transfer processed (audit logging failed)",
        warning: "Audit logging unavailable",
      });
    }
  }
);

/**
 * GET /api/audit/stats
 * Get anonymized transfer statistics (admin only)
 */
router.get("/stats", authenticateUser, async (req, res) => {
  try {
    // Only allow doctors to view stats (could add admin check)
    if (req.user.type !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Date range validation
    const fromDate = req.query.from
      ? new Date(req.query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to) : new Date();

    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
      });
    }

    // Get anonymized statistics
    const stats = await FileTransferAudit.getStats({
      from: fromDate,
      to: toDate,
    });

    res.json({
      success: true,
      data: {
        dateRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        statistics: stats,
        disclaimer: "Statistics are anonymized and contain no personal data",
      },
    });
  } catch (error) {
    console.error("Audit stats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve statistics",
    });
  }
});

/**
 * POST /api/audit/cleanup
 * Manual cleanup of old audit records (admin only)
 */
router.post("/cleanup", authenticateUser, async (req, res) => {
  try {
    // Only allow doctors to trigger cleanup (could add admin check)
    if (req.user.type !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Perform manual cleanup
    const deletedCount = await FileTransferAudit.cleanupOldRecords();

    res.json({
      success: true,
      message: "Cleanup completed",
      deletedRecords: deletedCount,
    });
  } catch (error) {
    console.error("Audit cleanup error:", error);

    res.status(500).json({
      success: false,
      message: "Cleanup failed",
    });
  }
});

/**
 * GET /api/audit/health
 * Check audit logging system health
 */
router.get("/health", async (req, res) => {
  try {
    // Test database connection by counting recent records
    const recentCount = await FileTransferAudit.countDocuments({
      sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      healthy: true,
      recentTransfers: recentCount,
      ttlEnabled: true,
      retentionDays: 90,
    });
  } catch (error) {
    console.error("Audit health check error:", error);

    res.json({
      success: false,
      healthy: false,
      error: "Database connection failed",
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error("Audit API error:", error);

  // Don't fail audit requests - they should be best effort
  res.json({
    success: true,
    message: "Request processed (with warnings)",
    warning: "Audit system temporarily unavailable",
  });
});

module.exports = router;
