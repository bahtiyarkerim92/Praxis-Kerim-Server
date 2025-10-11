const authController = require("../controllers/auth");
const doctorsController = require("../controllers/doctors");
const availabilityController = require("../controllers/availability");
const appointmentsController = require("../controllers/appointments");
const holidaysController = require("../controllers/holidays");
const ordersController = require("../controllers/orders");

module.exports = (app) => {
  app.get("/", (req, res) => {
    res.json({ message: "REST Service Working" });
  });

  // --- Authentication Routes ---
  app.use("/api/auth", authController);

  // --- API Routes ---
  app.use("/api/doctors", doctorsController);
  app.use("/api/availability", availabilityController);
  app.use("/api/appointments", appointmentsController);
  app.use("/api/holidays", holidaysController);
  app.use("/api/orders", ordersController);
};
