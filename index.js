require("dotenv").config();
const express = require("express");
const expressConfig = require("./config/express");
const databaseConfig = require("./config/database");
const routerConfig = require("./config/routes");

start();
async function start() {
  const app = express();

  expressConfig(app);
  await databaseConfig(app);

  routerConfig(app);

  app.listen(process.env.PORT, () =>
    console.log("REST Service started!", process.env.PORT)
  );
}
