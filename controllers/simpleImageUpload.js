const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads/doctors");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const extension = path.extname(file.originalname);
    cb(null, `${timestamp}_${randomString}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * Upload doctor profile image locally
 * POST /api/upload/local/doctor-profile
 */
const uploadDoctorProfile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Create public URL (adjust based on your server setup)
    const baseUrl =
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 3030}`;
    const imageUrl = `${baseUrl}/uploads/doctors/${req.file.filename}`;

    res.json({
      message: "Doctor profile image uploaded successfully",
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error("Doctor profile upload error:", error);
    res.status(500).json({
      message: "Failed to upload doctor profile image",
      error: error.message,
    });
  }
};

/**
 * Delete image endpoint (for local files)
 * DELETE /api/upload/local/image
 */
const deleteImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    // Extract filename from URL
    const filename = path.basename(imageUrl);
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists and delete it
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: "Image deleted successfully" });
    } else {
      res.status(404).json({ message: "Image not found" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      message: "Failed to delete image",
      error: error.message,
    });
  }
};

module.exports = {
  uploadDoctorProfile: [
    authenticateDoctorToken,
    upload.single("profileImage"),
    uploadDoctorProfile,
  ],
  deleteImage: [authenticateDoctorToken, deleteImage],
};
