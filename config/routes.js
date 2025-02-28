const authController = require("../controllers/auth");
const webexController = require("../controllers/webex");
module.exports = (app) => {
  app.get("/", (req, res) => {
    res.json({ message: "REST Service Working" });
  });

  app.use("/auth", authController);
  app.use("/webex", webexController);
};
