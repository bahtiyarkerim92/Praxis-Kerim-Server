const authController = require("../controllers/auth");

module.exports = (app) => {
  app.get("/", (req, res) => {
    res.json({ message: "REST Service Working" });
  });

  app.use("/auth", authController);
};
