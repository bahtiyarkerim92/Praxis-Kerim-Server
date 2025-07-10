const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3Client, bucketName, region } = require("./s3Config");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
require("dotenv").config();

/**
 * Upload a prescription PDF to S3 with secure, organized storage
 * @param {string} patientId - The patient's unique identifier
 * @param {Object} file - File object from multer with buffer and originalname
 * @returns {Promise<Object>} Upload result with URL and metadata
 */
async function uploadPrescription(patientId, file) {
  try {
    // Validate inputs
    if (!patientId) {
      throw new Error("Patient ID is required");
    }

    if (!file || !file.buffer) {
      throw new Error("Valid file with buffer is required");
    }

    // Validate file type
    if (file.mimetype !== "application/pdf") {
      throw new Error("Only PDF files are allowed for prescriptions");
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.buffer.length > maxSize) {
      throw new Error("File size must be less than 10MB");
    }

    // Generate secure filename
    const timestamp = Date.now();
    const uuid = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}_${uuid}${extension}`;

    // Create organized folder structure: patients/{patientId}/prescriptions/{filename}
    const key = `patients/${patientId}/prescriptions/${filename}`;

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
        "original-filename": file.originalname,
        "upload-timestamp": timestamp.toString(),
        "file-type": "prescription",
      },
    };

    console.log("Uploading prescription to S3:", {
      bucket: uploadParams.Bucket,
      key: uploadParams.Key,
      contentType: uploadParams.ContentType,
      size: file.buffer.length,
      patientId: patientId,
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
        contentType: file.mimetype,
        etag: uploadResult.ETag,
        uploadTimestamp: timestamp,
      },
      message: "Prescription uploaded successfully",
    };
  } catch (error) {
    console.error("Prescription upload error:", error);

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
 * Generate a presigned URL for secure access to a prescription
 * @param {string} key - The S3 key of the file
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
async function generatePresignedUrl(key, expiresIn = 3600) {
  try {
    console.log("Generating presigned URL for prescription:", {
      key,
      expiresIn,
      bucketName,
      region,
    });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn,
    });

    console.log("Prescription presigned URL generated successfully");
    return presignedUrl;
  } catch (error) {
    console.error("Error generating presigned URL for prescription:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });
    throw new Error("Failed to generate secure access URL");
  }
}

/**
 * Delete a prescription from S3
 * @param {string} key - The S3 key of the file to delete
 * @returns {Promise<Object>} Deletion result
 */
async function deletePrescription(key) {
  try {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);

    return {
      success: true,
      message: "Prescription deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting prescription:", error);
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || "DELETE_ERROR",
      },
    };
  }
}

module.exports = {
  uploadPrescription,
  generatePresignedUrl,
  deletePrescription,
};
