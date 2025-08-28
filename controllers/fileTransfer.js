/**
 * File Transfer Controller
 *
 * Provides endpoints for big file transfers via presigned URLs.
 * This is disabled by default and only used when FILE_TRANSFER_BIGFILES=true.
 *
 * The main file transfer happens via Daily.co app messages for files under 10MB.
 * This controller is for future enhancement to support larger files.
 */

const crypto = require("crypto");

// Feature flag - disabled by default
const BIGFILES_ENABLED = process.env.FILE_TRANSFER_BIGFILES === "true";

/**
 * Generate presigned URL for file upload (STUB)
 * POST /api/files/presign
 */
const generatePresignedUrl = async (req, res) => {
  try {
    // Feature flag check
    if (!BIGFILES_ENABLED) {
      return res.status(404).json({
        success: false,
        message: "Big file transfer is disabled",
      });
    }

    const { fileName, fileSize, contentType } = req.body;

    // Validate input
    if (!fileName || !fileSize || !contentType) {
      return res.status(400).json({
        success: false,
        message: "fileName, fileSize, and contentType are required",
      });
    }

    // Size limit for big files (e.g., 100MB)
    const MAX_BIG_FILE_SIZE = 100 * 1024 * 1024;
    if (fileSize > MAX_BIG_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "File too large for big file transfer",
      });
    }

    // Generate unique file key
    const fileKey = `transfers/${Date.now()}-${crypto.randomUUID()}-${fileName}`;

    // STUB: In real implementation, generate AWS S3 presigned URLs
    // const putUrl = await generateS3PresignedUrl(fileKey, contentType, 'PUT');
    // const getUrl = await generateS3PresignedUrl(fileKey, contentType, 'GET');

    const stubResponse = {
      success: true,
      data: {
        fileKey,
        putUrl: `https://stub-bucket.s3.amazonaws.com/${fileKey}?X-Amz-Signature=STUB`,
        getUrl: `https://stub-bucket.s3.amazonaws.com/${fileKey}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      },
    };

    res.json(stubResponse);
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate presigned URL",
    });
  }
};

/**
 * Delete uploaded file (STUB)
 * DELETE /api/files/:key
 */
const deleteFile = async (req, res) => {
  try {
    // Feature flag check
    if (!BIGFILES_ENABLED) {
      return res.status(404).json({
        success: false,
        message: "Big file transfer is disabled",
      });
    }

    const { key } = req.params;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "File key is required",
      });
    }

    // STUB: In real implementation, delete from S3
    // await deleteFromS3(key);

    res.json({
      success: true,
      message: "File deleted successfully (STUB)",
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
    });
  }
};

/**
 * Get file transfer status/info (STUB)
 * GET /api/files/:key/info
 */
const getFileInfo = async (req, res) => {
  try {
    // Feature flag check
    if (!BIGFILES_ENABLED) {
      return res.status(404).json({
        success: false,
        message: "Big file transfer is disabled",
      });
    }

    const { key } = req.params;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "File key is required",
      });
    }

    // STUB: In real implementation, check S3 object metadata
    res.json({
      success: true,
      data: {
        key,
        exists: false, // STUB: always false since we don't actually store files
        size: 0,
        contentType: "application/octet-stream",
        lastModified: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting file info:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get file info",
    });
  }
};

module.exports = {
  generatePresignedUrl,
  deleteFile,
  getFileInfo,
};
