# Appointment Reminder System - Quick Start

## ✅ Status: ENABLED AND READY

The appointment reminder system is now **production-ready** and will start automatically when you run the server.

## What It Does

- **24-Hour Reminders**: Sent 24 hours before appointments
- **2-Hour Reminders**: Sent 2 hours before appointments  
- **Multilingual**: Emails sent in patient's selected language (DE, EN, BG, PL, TR)
- **Automatic**: Runs every 30 minutes to check for appointments
- **Smart**: Prevents duplicate sends, handles errors gracefully

## Production Features Enabled

✅ Environment-based configuration  
✅ Detailed logging with timestamps  
✅ Error handling and recovery  
✅ Duplicate prevention  
✅ Automatic cleanup of old data  
✅ Configurable via `.env` file  
✅ Validates cron expressions  
✅ Graceful startup with 5-second delay  

## Server Logs You'll See

When server starts:
```
============================================================
📅 APPOINTMENT REMINDER SCHEDULER
============================================================
Environment: PRODUCTION 🚀
Schedule: */30 * * * *
24h Reminders: ENABLED ✅
2h Reminders: ENABLED ✅
============================================================

✅ Reminder scheduler started successfully!
   Next check will run according to schedule: */30 * * * *

🚀 Running initial reminder check...
```

When reminders are sent:
```
============================================================
[2025-11-03T10:30:00.000Z] 🔄 Checking for appointment reminders...
============================================================

📋 24-Hour Reminders: Found 3 appointments
  ✅ Sent to patient1@example.com | Appointment: 6543a1b2...
  ✅ Sent to patient2@example.com | Appointment: 7654b2c3...
  ⏭️  Already sent to patient3@example.com

📋 2-Hour Reminders: Found 1 appointments
  ✅ Sent to urgent@example.com | Appointment: 8765c3d4...

============================================================
📊 Summary: 3 sent, 0 failed
💾 Tracking 4 sent reminders in memory
============================================================
```

## Configuration (Optional)

Add to your `.env` file to customize:

```bash
# How often to check (default: every 30 minutes)
REMINDER_CHECK_INTERVAL=*/30 * * * *

# Enable/disable reminder types (default: both enabled)
ENABLE_24H_REMINDERS=true
ENABLE_2H_REMINDERS=true

# Production mode for optimized logging
NODE_ENV=production
```

### Cron Schedule Examples

```bash
*/15 * * * *   # Every 15 minutes (more frequent)
0 * * * *      # Every hour (less frequent)
*/5 * * * *    # Every 5 minutes (for testing)
0 */2 * * *    # Every 2 hours
```

## Testing

### 1. Test Immediately (Manual)
```bash
cd /Users/hasanovh/Desktop/praxis-kerim/telemedker-server
node scripts/testReminderEmail.js your-email@example.com
```

### 2. Check Server Logs
```bash
# The scheduler runs automatically
# Check console for log messages every 30 minutes
```

### 3. Create Test Appointment
1. Create an appointment exactly 24 hours from now
2. Wait for next scheduler run (or restart server)
3. Check patient's email inbox

## Monitoring

### What to Watch For

**Good Signs ✅:**
- `✅ Sent to ...` messages in logs
- Summary shows sent count increasing
- No error messages

**Warning Signs ⚠️:**
- `❌ Failed for ...` messages
- High failure count in summary
- `CRITICAL ERROR` messages

**To Investigate:**
- Check AWS SES dashboard for bounces
- Verify patient email addresses are valid
- Check spam folders
- Review AWS SES sending limits

## Troubleshooting

### Reminders Not Sending

1. **Check logs** - Look for error messages
2. **Verify appointments** - Must be "pending" or "confirmed" status
3. **Check timing** - Appointments must be exactly 24h or 2h away (±30min window)
4. **AWS SES** - Verify credentials and sending limits

### Too Many Logs

```bash
# Reduce check frequency in .env
REMINDER_CHECK_INTERVAL=0 * * * *  # Once per hour instead of every 30 min
```

### Disable Temporarily

```bash
# In .env
ENABLE_24H_REMINDERS=false
ENABLE_2H_REMINDERS=false
```

Or comment out in `index.js`:
```javascript
// startReminderScheduler();
```

## Files Modified

- ✅ `index.js` - Added scheduler startup
- ✅ `services/appointmentReminderScheduler.js` - Production-ready scheduler
- ✅ `ENV_SETUP.md` - Added configuration documentation

## Next Steps

1. **Monitor first 24 hours** - Watch logs for any issues
2. **Ask patients for feedback** - Is the timing good?
3. **Adjust timing if needed** - Change `REMINDER_CHECK_INTERVAL`
4. **Consider SMS reminders** - For critical appointments
5. **Set up monitoring alerts** - For high failure rates

## Support

- Scheduler code: `services/appointmentReminderScheduler.js`
- Email template: `emailTemplates/appointmentReminder.js`
- Mailer function: `services/mailer.js` → `sendAppointmentReminder()`
- Test script: `scripts/testReminderEmail.js`

## That's It! 🎉

The system is running automatically. Just make sure your server stays up and reminders will be sent automatically!

