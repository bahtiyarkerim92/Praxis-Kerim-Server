require("dotenv").config();
const express = require("express");
const expressConfig = require("./config/express");
const databaseConfig = require("./config/database");
const routerConfig = require("./config/routes");
const setupLocale = require("./config/locale");

start();
async function start() {
  const app = express();

  expressConfig(app);
  setupLocale(app);
  await databaseConfig(app);

  routerConfig(app);
  app.listen(process.env.PORT, () =>
    console.log("REST Service started!", process.env.PORT)
  );
}
