const { uploadSingle } = require("../services/aws/imageUpload");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, bucketName, region } = require("../services/aws/s3Config");
const path = require("path");

// Upload image to S3
exports.uploadImage = (req, res) => {
  console.log("S3 upload attempt - Doctor:", req.doctor?._id);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("uploadSingle type:", typeof uploadSingle);

  uploadSingle(req, res, async function (err) {
    if (err) {
      console.error("Multer error:", err);

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
        });
      }

      if (err.message === "Only image files are allowed!") {
        return res.status(400).json({
          success: false,
          message: "Only image files are allowed!",
        });
      }

      return res.status(400).json({
        success: false,
        message: "File upload error",
        error: err.message,
      });
    }

    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    try {
      // Generate unique filename
      const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
      const extension = path.extname(req.file.originalname);
      const key = `doctors/${uniqueSuffix}${extension}`;

      // Upload to S3 using AWS SDK v3
      const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      console.log("Uploading to S3 with params:", {
        bucket: uploadParams.Bucket,
        key: uploadParams.Key,
        contentType: uploadParams.ContentType,
        size: req.file.buffer.length,
      });

      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      // Generate the S3 URL
      const imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

      console.log("File uploaded successfully:", {
        key: key,
        location: imageUrl,
        bucket: bucketName,
      });

      // Return the S3 URL
      res.json({
        success: true,
        message: "Image uploaded successfully",
        imageUrl: imageUrl,
        key: key,
      });
    } catch (uploadError) {
      console.error("S3 upload error:", uploadError);
      res.status(500).json({
        success: false,
        message: "Failed to upload to S3",
        error: uploadError.message,
      });
    }
  });
};

// Delete image from S3
exports.deleteImage = async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Image key is required",
      });
    }

    const deleteParams = {
      Bucket: bucketName,
      Key: key,
    };

    console.log("Deleting from S3:", deleteParams);

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);

    console.log("Delete successful");

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
};
