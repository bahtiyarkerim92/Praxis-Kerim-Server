require("dotenv").config();
const express = require("express");
const expressConfig = require("./config/express");
const databaseConfig = require("./config/database");
const routerConfig = require("./config/routes");
const {
  startReminderScheduler,
} = require("./services/appointmentReminderScheduler");

start();
async function start() {
  const app = express();

  expressConfig(app);
  await databaseConfig(app);

  routerConfig(app);

  // Start appointment reminder scheduler (24h and 2h before appointments)
  startReminderScheduler();

  app.listen(process.env.PORT, () =>
    console.log("REST Service started!", process.env.PORT)
  );
}
