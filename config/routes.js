const authController = require("../controllers/auth");
const doctorAuthController = require("../controllers/doctorAuth");
const doctorsController = require("../controllers/doctors");
const availabilityController = require("../controllers/availability");
const appointmentsController = require("../controllers/appointments");

const paymentsController = require("../controllers/payments");
const s3ImageUploadController = require("../controllers/s3ImageUpload");
const simpleImageUploadController = require("../controllers/simpleImageUpload");
const fileTransferController = require("../controllers/fileTransfer");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");
const { authenticateToken } = require("../middleware/auth");

// Secure file transfer routes (BG/DE compliant)
const fallbackRoutes = require("../src/routes/filesFallback");
const auditRoutes = require("../src/routes/auditLog");
const dailyWebhookRoutes = require("../src/routes/webhooks/daily");
const ratingsRoutes = require("../src/routes/ratings");
const couponsRoutes = require("../src/routes/coupons");
const newsletterController = require("../controllers/newsletter");
const analyticsController = require("../controllers/analytics");

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
  app.use("/api/payments", paymentsController);

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

  // --- File Transfer Routes (Big Files - Disabled by default) ---
  app.post("/api/files/presign", fileTransferController.generatePresignedUrl);
  app.delete("/api/files/:key", fileTransferController.deleteFile);
  app.get("/api/files/:key/info", fileTransferController.getFileInfo);

  // --- Secure File Transfer Routes (BG/DE Compliant) ---
  app.use("/api/fallback", fallbackRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/webhooks/daily", dailyWebhookRoutes);

  // --- Rating Routes ---
  app.use("/api/ratings", ratingsRoutes);

  // --- Coupon Routes ---
  app.use("/api/coupons", couponsRoutes);

  // --- Newsletter Routes ---
  app.use("/api/newsletter", newsletterController);

  // --- Analytics Routes ---
  app.use("/api/analytics", analyticsController);
};
