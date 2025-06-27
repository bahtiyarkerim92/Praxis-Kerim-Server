const multer = require("multer");
const path = require("path");

// Configure multer for memory storage (we'll upload to S3 manually)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

module.exports = {
  uploadSingle: upload.single("image"),
  uploadMultiple: upload.array("images", 5),
};
