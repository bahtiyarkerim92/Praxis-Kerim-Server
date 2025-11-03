# Appointment Reminder Email Setup

## Overview
The appointment reminder system sends automated emails to patients to remind them of their upcoming appointments. The system supports two types of reminders using a single template:

1. **24-hour reminder** - Sent 24 hours before the appointment
2. **2-hour reminder** - Sent 2 hours before the appointment

Both reminders are multilingual and automatically sent in the patient's selected language (German, English, Bulgarian, Polish, or Turkish).

## Files Created/Modified

### 1. Email Template
**File**: `/emailTemplates/appointmentReminder.js`

A single template that adapts based on the reminder type (24h or 2h):
- Uses i18next for multilingual support
- Displays appointment details (doctor, date, time)
- Includes practice contact information
- Special note about video consultations on Fridays
- Dynamically adjusts "in 24 hours" vs "in 2 hours" based on `reminderType` parameter

### 2. Translation Files
All locale files updated with reminder email translations:
- `/locales/de.json` - German
- `/locales/en.json` - English
- `/locales/bg.json` - Bulgarian
- `/locales/pl.json` - Polish
- `/locales/tr.json` - Turkish

### 3. Mailer Service
**File**: `/services/mailer.js`

Added `sendAppointmentReminder()` function:
```javascript
sendAppointmentReminder(email, appointmentData, reminderType = "24h", locale = "de")
```

Parameters:
- `email`: Patient's email address
- `appointmentData`: Object containing appointment details
- `reminderType`: Either "24h" or "2h" (default: "24h")
- `locale`: Language code (default: "de")

## Email Content

### Subject Line
- **German**: "Erinnerung: Ihr Termin in 24 Stunden / 2 Stunden – Praxis Dr. Kerim"
- **English**: "Reminder: Your appointment in 24 hours / 2 hours – Praxis Dr. Kerim"
- (Similar translations for BG, PL, TR)

### Email Sections
1. **Greeting**: Personalized with patient name
2. **Reminder Text**: States when the appointment is (24h or 2h)
3. **Appointment Details Box**:
   - Doctor/Practitioner name
   - Date (localized format)
   - Time (localized format)
4. **Planning Note**: Reminder to plan for travel and wait times
5. **Cancellation Information**: How to cancel (phone, email, WhatsApp)
6. **Contact Information**:
   - Phone: Configurable via `PRACTICE_PHONE`
   - Email: Configurable via `PRACTICE_EMAIL`
   - WhatsApp: Configurable via `PRACTICE_WHATSAPP`
7. **Video Consultation Note**: Information about Friday video appointments
8. **Closing**: Friendly wishes and practice signature

## Usage

### Manual Sending (for testing)

```javascript
const { sendAppointmentReminder } = require("./services/mailer");

// Example appointment data
const appointmentData = {
  patientName: "Max Mustermann",
  doctorName: "Dr. Ibrahim Kerim",
  date: new Date("2025-11-04T10:00:00"),
};

// Send 24-hour reminder in German
await sendAppointmentReminder(
  "patient@example.com",
  appointmentData,
  "24h",
  "de"
);

// Send 2-hour reminder in English
await sendAppointmentReminder(
  "patient@example.com",
  appointmentData,
  "2h",
  "en"
);
```

### Automated Scheduling (Future Implementation)

To automate these reminders, you'll need to implement a scheduled job that:

1. Runs every hour (or more frequently)
2. Queries the database for appointments in the next 24 hours
3. Checks which appointments need a 24-hour reminder
4. Checks which appointments need a 2-hour reminder
5. Sends reminders only once per appointment (track sent reminders)

**Example with node-cron:**

```javascript
const cron = require("node-cron");
const Appointment = require("./models/Appointment");
const { sendAppointmentReminder } = require("./services/mailer");

// Run every hour
cron.schedule("0 * * * *", async () => {
  console.log("Checking for appointment reminders...");
  
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  try {
    // Find appointments that need 24-hour reminders
    const appointments24h = await Appointment.find({
      date: { $gte: now, $lte: in24Hours },
      reminder24hSent: { $ne: true },
      status: "confirmed"
    });
    
    for (const apt of appointments24h) {
      await sendAppointmentReminder(
        apt.patient.email,
        {
          patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
          doctorName: apt.doctor.name,
          date: apt.date,
        },
        "24h",
        apt.patient.locale || "de"
      );
      
      // Mark as sent
      apt.reminder24hSent = true;
      await apt.save();
    }
    
    // Similar logic for 2-hour reminders...
    
  } catch (error) {
    console.error("Error sending reminders:", error);
  }
});
```

## Required Database Schema Updates

To track sent reminders, add these fields to the Appointment model:

```javascript
{
  reminder24hSent: {
    type: Boolean,
    default: false,
  },
  reminder24hSentAt: {
    type: Date,
  },
  reminder2hSent: {
    type: Boolean,
    default: false,
  },
  reminder2hSentAt: {
    type: Date,
  },
}
```

## Translation Keys

The reminder email uses the `reminderEmail` namespace:

```json
{
  "reminderEmail": {
    "subject": "Subject with {{time}} placeholder",
    "previewText": "Preview text",
    "title": "Email title",
    "time24h": "24 hours / 24 Stunden / etc",
    "time2h": "2 hours / 2 Stunden / etc",
    "greeting": "Greeting with {{patientName}}",
    "reminderText": "Reminder text with {{time}}",
    "doctor": "Doctor label",
    "date": "Date label",
    "time": "Time label",
    "planAhead": "Planning note",
    "cancellationNote": "Cancellation information",
    "phone": "Phone label",
    "email": "Email label",
    "whatsapp": "WhatsApp label",
    "videoNote": "Video consultation note",
    "lookingForward": "Closing message",
    "regards": "Regards",
    "practiceName": "Practice name",
    "address": "Practice address",
    "footer": "Footer with {{year}}"
  }
}
```

## Environment Variables

The following environment variables are used (same as other emails):

```env
PRACTICE_PHONE=+49 69 870015360
PRACTICE_EMAIL=info@praxiskerim.de
PRACTICE_WHATSAPP=+49 69 870015360

AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-north-1
```

## Testing

### Manual Test

1. Create a test script:

```javascript
// testReminder.js
require("dotenv").config();
const { sendAppointmentReminder } = require("./services/mailer");

async function test() {
  const testData = {
    patientName: "Test Patient",
    doctorName: "Dr. Test Doctor",
    date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  };
  
  // Test 24-hour reminder in German
  await sendAppointmentReminder(
    "your-email@example.com",
    testData,
    "24h",
    "de"
  );
  
  console.log("24-hour reminder sent!");
  
  // Test 2-hour reminder in English
  await sendAppointmentReminder(
    "your-email@example.com",
    testData,
    "2h",
    "en"
  );
  
  console.log("2-hour reminder sent!");
}

test().catch(console.error);
```

2. Run the test:
```bash
node testReminder.js
```

## Supported Languages

| Language   | Code | Time Format   |
|-----------|------|---------------|
| German    | de   | 24 Stunden / 2 Stunden |
| English   | en   | 24 hours / 2 hours |
| Bulgarian | bg   | 24 часа / 2 часа |
| Polish    | pl   | 24 godziny / 2 godziny |
| Turkish   | tr   | 24 saat / 2 saat |

## Notes

- The template automatically formats dates and times based on the locale
- Both reminder types use the same HTML template for consistency
- The system gracefully handles missing patient data
- Failed email sends are logged but don't block the system
- Consider implementing a retry mechanism for failed sends
- Track reminder sends in the database to avoid duplicates
- Consider time zones when scheduling reminders

