const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, bucketName, region } = require("./s3Config");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
require("dotenv").config();

// Supported file types for documents
const SUPPORTED_FILE_TYPES = {
  // Documents
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "text/plain": ".txt",
  "application/rtf": ".rtf",

  // Images
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tiff",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",

  // Spreadsheets
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",

  // Presentations
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",

  // Other medical formats
  "application/dicom": ".dcm",
  "application/xml": ".xml",
  "application/json": ".json",
};

// Document categories
const DOCUMENT_CATEGORIES = {
  "medical-reports": "medical-reports",
  "lab-results": "lab-results",
  "radiology-reports": "radiology-reports",
  "insurance-documents": "insurance-documents",
};

/**
 * Upload a document to S3 with secure, organized storage by category
 * @param {string} patientId - The patient's unique identifier
 * @param {string} category - Document category (medical-reports, lab-results, radiology-reports, insurance-documents)
 * @param {Object} file - File object from multer with buffer and originalname
 * @returns {Promise<Object>} Upload result with URL and metadata
 */
async function uploadDocument(patientId, category, file) {
  try {
    // Validate inputs
    if (!patientId) {
      throw new Error("Patient ID is required");
    }

    if (!category || !DOCUMENT_CATEGORIES[category]) {
      throw new Error(
        `Invalid category. Must be one of: ${Object.keys(DOCUMENT_CATEGORIES).join(", ")}`
      );
    }

    if (!file || !file.buffer) {
      throw new Error("Valid file with buffer is required");
    }

    // Validate file type
    if (!SUPPORTED_FILE_TYPES[file.mimetype]) {
      const supportedTypes = Object.values(SUPPORTED_FILE_TYPES).join(", ");
      throw new Error(
        `Unsupported file type. Supported formats: ${supportedTypes}`
      );
    }

    // Validate file size (25MB limit for documents to accommodate larger files)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.buffer.length > maxSize) {
      throw new Error("File size must be less than 25MB");
    }

    // Generate secure filename
    const timestamp = Date.now();
    const uuid = uuidv4();
    const extension =
      path.extname(file.originalname) || SUPPORTED_FILE_TYPES[file.mimetype];
    const filename = `${timestamp}_${uuid}${extension}`;

    // Create organized folder structure: patients/{patientId}/documents/{category}/{filename}
    const key = `patients/${patientId}/documents/${category}/${filename}`;

    // Prepare upload parameters with security settings
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Security settings - block public access
      ACL: "private", // Ensure file is private
      ServerSideEncryption: "AES256", // Encrypt at rest
      Metadata: {
        "patient-id": patientId,
        category: category,
        "original-filename": file.originalname,
        "upload-timestamp": timestamp.toString(),
        "file-type": "document",
      },
    };

    console.log("Uploading document to S3:", {
      bucket: uploadParams.Bucket,
      key: uploadParams.Key,
      contentType: uploadParams.ContentType,
      size: file.buffer.length,
      patientId: patientId,
      category: category,
    });

    // Upload to S3
    const command = new PutObjectCommand(uploadParams);
    const uploadResult = await s3Client.send(command);

    // Generate the S3 URL (private - will need presigned URL for access)
    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    // Return success result
    return {
      success: true,
      data: {
        fileUrl,
        key,
        bucket: bucketName,
        filename,
        originalFilename: file.originalname,
        fileSize: file.buffer.length,
        patientId,
        category,
        contentType: file.mimetype,
        etag: uploadResult.ETag,
        uploadTimestamp: timestamp,
      },
      message: "Document uploaded successfully",
    };
  } catch (error) {
    console.error("Document upload error:", error);

    // Return structured error
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || "UPLOAD_ERROR",
        details: error.name || "Unknown error",
      },
    };
  }
}

/**
 * Generate a presigned URL for secure access to a document
 * @param {string} key - The S3 key of the file
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
async function generatePresignedUrl(key, expiresIn = 3600) {
  try {
    console.log("=== DOCUMENT SERVICE - generatePresignedUrl called ===");
    console.log("generatePresignedUrl called with:", {
      key,
      expiresIn,
      bucketName,
      region,
    });

    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const { GetObjectCommand } = require("@aws-sdk/client-s3");

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    console.log("S3 GetObjectCommand created:", {
      Bucket: bucketName,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn,
    });

    console.log(
      "Presigned URL generated successfully:",
      presignedUrl.substring(0, 100) + "..."
    );
    return presignedUrl;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw new Error("Failed to generate secure access URL");
  }
}

/**
 * Delete a document from S3
 * @param {string} key - The S3 key of the file to delete
 * @returns {Promise<Object>} Deletion result
 */
async function deleteDocument(key) {
  try {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);

    return {
      success: true,
      message: "Document deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting document:", error);
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || "DELETE_ERROR",
      },
    };
  }
}

/**
 * Get file extension from mime type
 * @param {string} mimeType - The MIME type
 * @returns {string} File extension
 */
function getFileExtension(mimeType) {
  return SUPPORTED_FILE_TYPES[mimeType] || "";
}

/**
 * Check if file type is supported
 * @param {string} mimeType - The MIME type to check
 * @returns {boolean} Whether the file type is supported
 */
function isFileTypeSupported(mimeType) {
  return !!SUPPORTED_FILE_TYPES[mimeType];
}

/**
 * Get human-readable category name
 * @param {string} category - The category key
 * @returns {string} Human-readable category name
 */
function getCategoryDisplayName(category) {
  const categoryNames = {
    "medical-reports": "Medical Reports",
    "lab-results": "Lab Results",
    "radiology-reports": "Radiology Reports",
    "insurance-documents": "Insurance Documents",
  };
  return categoryNames[category] || category;
}

module.exports = {
  uploadDocument,
  generatePresignedUrl,
  deleteDocument,
  getFileExtension,
  isFileTypeSupported,
  getCategoryDisplayName,
  SUPPORTED_FILE_TYPES,
  DOCUMENT_CATEGORIES,
};
