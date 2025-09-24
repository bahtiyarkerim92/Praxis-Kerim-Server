/**
 * S3 Storage Utilities for Encrypted File Fallback
 * Handles presigned URLs for secure file uploads/downloads
 * Compliant with BG/DE privacy regulations
 *
 * Features:
 * - EU region storage (GDPR compliance)
 * - Short-lived presigned URLs (10 minutes max)
 * - Automatic cleanup via object lifecycle
 * - Server-side encryption (AES256)
 * - No server access to file contents
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

// Configuration from environment - using your existing variable names
const STORAGE_REGION = process.env.AWS_S3_REGION || "eu-north-1";
const STORAGE_BUCKET = process.env.AWS_S3_BUCKETNAME || "telemedker-temp";
const STORAGE_TTL_MIN = parseInt(process.env.STORAGE_TTL_MIN || "10");
const FILE_MAX_BYTES = parseInt(process.env.FILE_MAX_BYTES || "104857600"); // 100MB

// Initialize S3 client with EU region - using your existing credentials
const s3Client = new S3Client({
  region: STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate secure object key for encrypted file storage
 * Format: meetings/{meetingId}/files/{timestamp}-{random}.enc
 */
function generateObjectKey(meetingId, fileExtension = "") {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString("hex");
  const sanitizedMeetingId = meetingId.replace(/[^a-zA-Z0-9\-_]/g, "");

  return `meetings/${sanitizedMeetingId}/files/${timestamp}-${randomBytes}${fileExtension}.enc`;
}

/**
 * Create presigned PUT URL for encrypted file upload
 * @param {string} meetingId - Meeting identifier
 * @param {number} fileSize - File size in bytes
 * @param {string} contentType - MIME type
 * @returns {Promise<{uploadUrl: string, objectKey: string, expiresAt: string}>}
 */
async function getPresignedPut(
  meetingId,
  fileSize,
  contentType = "application/octet-stream"
) {
  try {
    // Validate inputs
    if (!meetingId || typeof meetingId !== "string") {
      throw new Error("Invalid meeting ID");
    }

    if (!fileSize || fileSize > FILE_MAX_BYTES || fileSize < 1) {
      throw new Error(
        `File size must be between 1 and ${FILE_MAX_BYTES} bytes`
      );
    }

    // Generate unique object key
    const objectKey = generateObjectKey(meetingId);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + STORAGE_TTL_MIN * 60 * 1000);

    // Create PUT command with security headers
    const command = new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: fileSize,
      ServerSideEncryption: "AES256",
      Metadata: {
        "meeting-id": meetingId,
        "upload-time": Date.now().toString(),
        "content-encrypted": "true", // Client-side encrypted
      },
      // Set object lifecycle for automatic cleanup
      Tagging: `meeting=${meetingId}&encrypted=true&expires=${expiresAt.toISOString()}`,
    });

    // Generate presigned URL
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: STORAGE_TTL_MIN * 60, // Convert minutes to seconds
    });

    return {
      uploadUrl,
      objectKey,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error("Failed to create presigned PUT URL:", error);
    throw new Error("Failed to create upload URL");
  }
}

/**
 * Create presigned GET URL for encrypted file download
 * @param {string} objectKey - S3 object key
 * @returns {Promise<{downloadUrl: string, expiresAt: string}>}
 */
async function getPresignedGet(objectKey) {
  try {
    // Validate object key
    if (!objectKey || typeof objectKey !== "string") {
      throw new Error("Invalid object key");
    }

    // Ensure object key follows expected pattern for security
    if (!objectKey.startsWith("meetings/") || !objectKey.includes("/files/")) {
      throw new Error("Invalid object key format");
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + STORAGE_TTL_MIN * 60 * 1000);

    // Create GET command
    const command = new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: objectKey,
    });

    // Generate presigned URL
    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: STORAGE_TTL_MIN * 60, // Convert minutes to seconds
    });

    return {
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error("Failed to create presigned GET URL:", error);
    throw new Error("Failed to create download URL");
  }
}

/**
 * Delete objects by meeting ID (cleanup after meeting ends)
 * @param {string} meetingId - Meeting identifier
 * @returns {Promise<number>} Number of objects deleted
 */
async function deleteByMeetingId(meetingId) {
  try {
    if (!meetingId || typeof meetingId !== "string") {
      throw new Error("Invalid meeting ID");
    }

    const sanitizedMeetingId = meetingId.replace(/[^a-zA-Z0-9\-_]/g, "");
    const prefix = `meetings/${sanitizedMeetingId}/files/`;

    // List objects with the meeting prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: STORAGE_BUCKET,
      Prefix: prefix,
      MaxKeys: 1000, // Reasonable limit
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log(`No objects found for meeting ${meetingId}`);
      return 0;
    }

    // Delete objects in batches
    let deletedCount = 0;
    for (const object of listResponse.Contents) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: STORAGE_BUCKET,
          Key: object.Key,
        });

        await s3Client.send(deleteCommand);
        deletedCount++;

        console.log(`Deleted object: ${object.Key}`);
      } catch (deleteError) {
        console.error(`Failed to delete object ${object.Key}:`, deleteError);
        // Continue with other objects
      }
    }

    console.log(`Deleted ${deletedCount} objects for meeting ${meetingId}`);
    return deletedCount;
  } catch (error) {
    console.error("Failed to delete objects by meeting ID:", error);
    return 0;
  }
}

/**
 * Delete a specific object by key
 * @param {string} objectKey - S3 object key
 * @returns {Promise<boolean>} Success status
 */
async function deleteObject(objectKey) {
  try {
    if (!objectKey || typeof objectKey !== "string") {
      throw new Error("Invalid object key");
    }

    // Security check - only allow deletion of our encrypted files
    if (!objectKey.startsWith("meetings/") || !objectKey.endsWith(".enc")) {
      throw new Error("Invalid object key format");
    }

    const command = new DeleteObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: objectKey,
    });

    await s3Client.send(command);
    console.log(`Deleted object: ${objectKey}`);
    return true;
  } catch (error) {
    console.error("Failed to delete object:", error);
    return false;
  }
}

/**
 * Clean up expired objects (manual cleanup if lifecycle rules fail)
 * This should be run periodically via cron job
 * @returns {Promise<number>} Number of objects cleaned up
 */
async function cleanupExpiredObjects() {
  try {
    const cutoffTime = Date.now() - STORAGE_TTL_MIN * 60 * 1000;

    // List all objects in the meetings prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: STORAGE_BUCKET,
      Prefix: "meetings/",
      MaxKeys: 1000,
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return 0;
    }

    let cleanedCount = 0;
    for (const object of listResponse.Contents) {
      // Check if object is older than TTL
      if (object.LastModified && object.LastModified.getTime() < cutoffTime) {
        try {
          await deleteObject(object.Key);
          cleanedCount++;
        } catch (deleteError) {
          console.error(`Failed to cleanup object ${object.Key}:`, deleteError);
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} expired objects`);
    return cleanedCount;
  } catch (error) {
    console.error("Failed to cleanup expired objects:", error);
    return 0;
  }
}

/**
 * Validate storage configuration
 * @returns {Promise<boolean>} Configuration is valid
 */
async function validateConfig() {
  // Skip S3 validation in development if no AWS credentials (using your variable names)
  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.AWS_S3_ACCESS_KEY_ID || !process.env.AWS_S3_SECRET_ACCESS_KEY)
  ) {
    console.log("S3 validation skipped in development (no AWS credentials)");
    return false; // Return false so fallback shows as unavailable
  }

  try {
    // Test S3 connection by listing bucket (without objects)
    const listCommand = new ListObjectsV2Command({
      Bucket: STORAGE_BUCKET,
      MaxKeys: 1,
    });

    await s3Client.send(listCommand);

    console.log("S3 storage configuration validated successfully");
    return true;
  } catch (error) {
    console.warn("S3 storage configuration validation failed:", error.message);
    return false;
  }
}

module.exports = {
  getPresignedPut,
  getPresignedGet,
  deleteByMeetingId,
  deleteObject,
  cleanupExpiredObjects,
  validateConfig,

  // Constants for reference
  STORAGE_REGION,
  STORAGE_BUCKET,
  STORAGE_TTL_MIN,
  FILE_MAX_BYTES,
};
