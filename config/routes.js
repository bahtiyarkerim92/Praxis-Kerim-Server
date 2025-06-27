const authController = require("../controllers/auth");
const doctorAuthController = require("../controllers/doctorAuth");
const doctorsController = require("../controllers/doctors");
const availabilityController = require("../controllers/availability");
const appointmentsController = require("../controllers/appointments");
const s3ImageUploadController = require("../controllers/s3ImageUpload");
const simpleImageUploadController = require("../controllers/simpleImageUpload");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");

module.exports = (app) => {
  app.get("/", (req, res) => {
    res.json({ message: "REST Service Working" });
  });

  // --- Authentication Routes ---
  app.use("/auth", authController); // Patient authentication
  app.use("/api/doctor-auth", doctorAuthController); // Doctor authentication

  // --- API Routes ---
  app.use("/api/doctors", doctorsController);
  app.use("/api/availability", availabilityController);
  app.use("/api/appointments", appointmentsController);

  // --- S3 Upload Routes ---
  app.post(
    "/api/upload/s3/doctor-profile",
    authenticateDoctorToken,
    s3ImageUploadController.uploadImage
  );
  app.post(
    "/api/upload/s3/image",
    authenticateDoctorToken,
    s3ImageUploadController.uploadImage
  );
  app.delete(
    "/api/upload/s3/image",
    authenticateDoctorToken,
    s3ImageUploadController.deleteImage
  );

  // --- Local Upload Routes (Development) ---
  app.post(
    "/api/upload/local/doctor-profile",
    simpleImageUploadController.uploadDoctorProfile
  );
  app.delete(
    "/api/upload/local/image",
    simpleImageUploadController.deleteImage
  );
};
