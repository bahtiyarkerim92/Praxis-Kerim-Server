const multer = require("multer");
const path = require("path");

// Configure multer for memory storage (we'll upload to S3 manually)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for PDF files
  },
  fileFilter: function (req, file, cb) {
    // Check file type - only PDF files are allowed
    const allowedTypes = /pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = file.mimetype === "application/pdf";

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"));
    }
  },
});

module.exports = {
  uploadSingle: upload.single("pdf"),
  uploadMultiple: upload.array("pdfs", 5),
};
