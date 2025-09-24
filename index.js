require("dotenv").config();
const express = require("express");
const expressConfig = require("./config/express");
const databaseConfig = require("./config/database");
const routerConfig = require("./config/routes");
const setupLocale = require("./config/locale");
const { setupSecurity, sanitizeErrors } = require("./src/config/security");

start();
async function start() {
  const app = express();

  // Setup security middleware first
  setupSecurity(app);

  expressConfig(app);
  setupLocale(app);
  await databaseConfig(app);

  routerConfig(app);

  // Add error handling middleware last
  app.use(sanitizeErrors);

  app.listen(process.env.PORT, () =>
    console.log("REST Service started!", process.env.PORT)
  );
}
