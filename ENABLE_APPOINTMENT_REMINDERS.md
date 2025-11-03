# How to Enable Automatic Appointment Reminders

## Overview
The appointment reminder system is **ready to use** but needs to be enabled. Follow these steps to activate automatic 24-hour and 2-hour reminders.

## Step 1: Install Dependencies

The system uses `node-cron` for scheduling. Install it:

```bash
cd /Users/hasanovh/Desktop/praxis-kerim/telemedker-server
npm install node-cron
```

## Step 2: Enable the Scheduler

Update `index.js` to start the reminder scheduler:

### Current `index.js`:
```javascript
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
```

### Updated `index.js` (with reminders):
```javascript
require("dotenv").config();
const express = require("express");
const expressConfig = require("./config/express");
const databaseConfig = require("./config/database");
const routerConfig = require("./config/routes");
const { startReminderScheduler } = require("./services/appointmentReminderScheduler");

start();
async function start() {
  const app = express();

  expressConfig(app);
  await databaseConfig(app);

  routerConfig(app);

  // Start appointment reminder scheduler
  startReminderScheduler();

  app.listen(process.env.PORT, () =>
    console.log("REST Service started!", process.env.PORT)
  );
}
```

## Step 3: Restart the Server

```bash
# If running in development
npm run dev

# If running in production
pm2 restart telemedker-server
# or
node index.js
```

## How It Works

### Scheduling
- **Runs every 30 minutes** to check for appointments
- Checks for appointments 24 hours away (sends 24h reminder)
- Checks for appointments 2 hours away (sends 2h reminder)
- Uses a 30-minute window to catch appointments

### Reminder Logic
1. **24-Hour Reminder**: Sent between 24h - 23.5h before appointment
2. **2-Hour Reminder**: Sent between 2h - 1.5h before appointment
3. **Duplicate Prevention**: Tracks sent reminders to avoid duplicates
4. **Status Filter**: Only sends to "pending" or "confirmed" appointments
5. **Automatic Cleanup**: Removes old reminder tracking data after 48 hours

### What Gets Sent
- Patient's name
- Doctor's name
- Appointment date/time
- Contact information
- Cancellation instructions
- Video consultation note (if applicable)

### Language Support
- Automatically uses the patient's `locale` from their appointment record
- Falls back to German ("de") if no locale specified
- Supports: German, English, Bulgarian, Polish, Turkish

## Monitoring

The scheduler logs to console:

```
📅 Starting appointment reminder scheduler...
   Running every 30 minutes
✅ Reminder scheduler started successfully!

⏰ Running scheduled reminder check...
Found 3 appointments needing 24h reminders
✓ Sent 24h reminder to patient@example.com for appointment 6543...
✓ Sent 24h reminder to another@example.com for appointment 7654...
Found 1 appointments needing 2h reminders
✓ Sent 2h reminder to urgent@example.com for appointment 8765...
```

## Testing Without Waiting

### Manual Test (Immediate)
```bash
# Test the reminder emails immediately
node scripts/testReminderEmail.js your-email@example.com
```

### Test the Scheduler (Without Full Wait)
Create a test appointment with a time 24 hours or 2 hours from now, then:
```javascript
const { startReminderScheduler } = require("./services/appointmentReminderScheduler");
startReminderScheduler(); // Will run immediately and then every 30 minutes
```

## Configuration

### Change Reminder Timing
Edit `services/appointmentReminderScheduler.js`:

```javascript
// Current: 24 hours before
const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

// Change to 48 hours before:
const in24Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
```

### Change Schedule Frequency
Edit the cron schedule in `appointmentReminderScheduler.js`:

```javascript
// Current: Every 30 minutes
cron.schedule("*/30 * * * *", ...);

// Every 15 minutes:
cron.schedule("*/15 * * * *", ...);

// Every hour:
cron.schedule("0 * * * *", ...);

// Every day at 9 AM:
cron.schedule("0 9 * * *", ...);
```

## Troubleshooting

### Reminders Not Being Sent

1. **Check server logs** for errors
2. **Verify appointments exist** in the correct time window
3. **Check appointment status** (must be "pending" or "confirmed")
4. **Verify patient email** is valid in the appointment record
5. **Check AWS SES** sending limits and credentials

### Duplicate Reminders

- The system prevents duplicates using an in-memory Set
- If server restarts, it may send reminders again
- Consider adding a `reminders_sent` field to the Appointment model for persistence

### No Logs Appearing

- Ensure the scheduler is started in `index.js`
- Check that the server didn't crash
- Verify database connection is working

## Production Recommendations

### 1. Add Database Tracking
Update the Appointment model to track sent reminders:

```javascript
{
  reminder24hSent: { type: Boolean, default: false },
  reminder24hSentAt: { type: Date },
  reminder2hSent: { type: Boolean, default: false },
  reminder2hSentAt: { type: Date },
}
```

Then update the scheduler to check and update these fields.

### 2. Add Error Notifications
Set up monitoring to alert you if reminders fail:

```javascript
// In appointmentReminderScheduler.js
if (failureCount > 5) {
  // Send alert to admin
  await sendAdminAlert("High reminder failure rate");
}
```

### 3. Use Queue System (Optional)
For high-volume practices, consider using a job queue like Bull or BullMQ instead of cron.

## Disabling Reminders

To temporarily disable automatic reminders:

### Option 1: Remove from index.js
Comment out or remove this line:
```javascript
// startReminderScheduler();
```

### Option 2: Stop Specific Types
Edit `appointmentReminderScheduler.js` and comment out the sections you don't want.

## Next Steps

After enabling:
1. ✅ Monitor the first few days for issues
2. ✅ Check spam folders to ensure delivery
3. ✅ Ask patients for feedback on reminder timing
4. ✅ Consider adding SMS reminders for critical appointments
5. ✅ Set up monitoring/alerting for failed sends

## Support

- Test scripts: `scripts/testReminderEmail.js`
- Email templates: `emailTemplates/appointmentReminder.js`
- Mailer service: `services/mailer.js`
- Scheduler: `services/appointmentReminderScheduler.js`

