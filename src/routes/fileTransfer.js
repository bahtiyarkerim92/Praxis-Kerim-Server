// @ts-check
const router = require("express").Router();
const { z } = require("zod");
const { appointmentAccess } = require("../middleware/appointmentAccess");
const { rateLimit } = require("../middleware/rateLimit");
const { presignPut, presignGet, deleteObject } = require("../lib/s3");
const { makeOpaqueKey, sanitizeDownloadName } = require("../lib/keys");
const FileTransfer = require("../models/FileTransfer");
const { authenticateToken } = require("../../middleware/auth");

const MAX_MB = Number(process.env.FILE_TRANSFER_MAX_BIG_MB || 100);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const EXP = Number(process.env.FILE_TRANSFER_PRESIGN_EXPIRY_SECONDS || 600);
const ALLOWED_CT = new Set(
  String(
    process.env.ALLOWED_FILE_CT ||
      "application/pdf,image/jpeg,image/png,image/webp,text/plain,application/zip,application/x-zip-compressed,application/x-zip"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const UploadSchema = z.object({
  appointmentId: z.string().min(6),
  originalFileName: z.string().min(1),
  size: z.number().int().positive().max(MAX_BYTES),
  contentType: z.string().min(1),
  sha256: z.string().length(64), // hex
});

// Check if big file transfers are enabled
function checkBigFilesEnabled(req, res, next) {
  if (process.env.FILE_TRANSFER_BIGFILES !== "true") {
    return res
      .status(503)
      .json({ success: false, message: "Big file transfers not enabled" });
  }
  next();
}

router.post(
  "/api/files/presign/upload",
  checkBigFilesEnabled,
  authenticateToken,
  appointmentAccess,
  rateLimit,
  async (req, res, next) => {
    try {
      const parsed = UploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid payload",
          errors: parsed.error.errors,
        });
      }
      const { appointmentId, originalFileName, size, contentType, sha256 } =
        parsed.data;

      if (ALLOWED_CT.size && !ALLOWED_CT.has(contentType)) {
        return res
          .status(400)
          .json({ success: false, message: "Content-Type not allowed" });
      }

      const key = makeOpaqueKey({
        appointmentId,
        senderId: String(req.user._id),
      });
      const displayName = sanitizeDownloadName(originalFileName);

      // Client must send Content-MD5 header; we presign for it
      const contentMd5 = req.header("x-file-content-md5") || "";
      if (!contentMd5) {
        return res.status(400).json({
          success: false,
          message: "Missing x-file-content-md5 header",
        });
      }

      const putUrl = await presignPut({
        key,
        contentType,
        contentMd5,
        expiresSeconds: EXP,
      });

      // Minimal audit (no filename for GDPR compliance)
      await FileTransfer.create({
        appointmentId,
        senderId: req.user._id,
        recipientIds: [],
        key,
        size,
        sha256,
      });

      // Log for debugging (no PHI)
      console.log(
        `File transfer initiated: appointmentId=${appointmentId}, size=${size}, key=${key.split("/").pop()}`
      );

      res.json({
        success: true,
        data: {
          key,
          putUrl,
          displayName,
          maxSizeMB: MAX_MB,
          expiresAt: new Date(Date.now() + EXP * 1000).toISOString(),
        },
      });
    } catch (e) {
      console.error("File presign upload error:", e.message);
      next(e);
    }
  }
);

router.get(
  "/api/files/presign/download",
  checkBigFilesEnabled,
  authenticateToken,
  appointmentAccess,
  rateLimit,
  async (req, res, next) => {
    try {
      const { appointmentId, key, name } = req.query;
      if (!key || !name) {
        return res
          .status(400)
          .json({ success: false, message: "key and name required" });
      }

      const rec = await FileTransfer.findOne({
        appointmentId,
        key,
        deletedAt: { $exists: false },
      }).lean();

      if (!rec) {
        return res
          .status(404)
          .json({ success: false, message: "File not found or expired" });
      }

      const getUrl = await presignGet({
        key,
        downloadName: sanitizeDownloadName(String(name)),
        expiresSeconds: EXP,
      });

      // Log access (no PHI)
      console.log(
        `File download presigned: appointmentId=${appointmentId}, key=${key.split("/").pop()}, userId=${req.user._id}`
      );

      res.json({
        success: true,
        data: {
          getUrl,
          expiresAt: new Date(Date.now() + EXP * 1000).toISOString(),
        },
      });
    } catch (e) {
      console.error("File presign download error:", e.message);
      next(e);
    }
  }
);

router.delete(
  "/api/files",
  checkBigFilesEnabled,
  authenticateToken,
  appointmentAccess,
  rateLimit,
  async (req, res, next) => {
    try {
      const { appointmentId, key } = req.body || {};
      if (!key) {
        return res
          .status(400)
          .json({ success: false, message: "key required" });
      }

      // Verify ownership or participant status
      const rec = await FileTransfer.findOne({
        appointmentId,
        key,
        deletedAt: { $exists: false },
      }).lean();

      if (!rec) {
        return res
          .status(404)
          .json({ success: false, message: "File not found" });
      }

      // Only sender can delete, or any participant during appointment window
      const canDelete =
        String(rec.senderId) === String(req.user._id) || req.userRole;
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to delete this file",
        });
      }

      // Delete from S3 (ignore errors - lifecycle will clean up)
      await deleteObject({ key }).catch((err) => {
        console.warn(`S3 delete failed for key ${key}:`, err.message);
      });

      // Mark as deleted in audit trail
      await FileTransfer.updateOne(
        { appointmentId, key },
        { $set: { deletedAt: new Date() } }
      );

      console.log(
        `File deleted: appointmentId=${appointmentId}, key=${key.split("/").pop()}, userId=${req.user._id}`
      );

      res.json({ success: true, message: "File deleted successfully" });
    } catch (e) {
      console.error("File delete error:", e.message);
      next(e);
    }
  }
);

// Health check endpoint
router.get("/api/files/health", (req, res) => {
  res.json({
    success: true,
    bigFilesEnabled: process.env.FILE_TRANSFER_BIGFILES === "true",
    maxSizeMB: MAX_MB,
    allowedContentTypes: Array.from(ALLOWED_CT),
    presignExpirySeconds: EXP,
  });
});

module.exports = router;
