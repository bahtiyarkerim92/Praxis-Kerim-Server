# Appointment Cancellation Email Setup

## Overview

This system automatically sends a multilingual cancellation email to patients when their appointment is cancelled by the admin from the dashboard.

## Features

- **Multilingual Support**: Emails are sent in the patient's preferred language (German, English, Bulgarian, Polish, Turkish)
- **Automatic Email Sending**: When an admin cancels an appointment, the patient automatically receives a cancellation notification
- **Professional Template**: Clean, responsive email design with practice contact information
- **Error Handling**: Email failures don't prevent appointment cancellation

## How It Works

### 1. Admin Cancels Appointment

When an admin clicks the "Absagen" (Cancel) button in the dashboard:

1. The appointment status is changed to `"cancelled"`
2. The `cancelledAt` timestamp is set
3. The cancellation reason is saved (if provided)
4. A cancellation email is automatically sent to the patient

### 2. Email Content

The cancellation email includes:

- **Subject**: Appointment cancellation notice
- **Cancelled Appointment Details**:
  - Doctor name
  - Appointment date
  - Appointment time
- **Apology Message**: Expressing regret for the inconvenience
- **Rescheduling Information**: Instructions to contact the practice
- **Contact Information**:
  - Phone: `PRACTICE_PHONE`
  - Email: `PRACTICE_EMAIL`
  - WhatsApp: `PRACTICE_WHATSAPP`

### 3. Language Detection

The email language is determined by the `locale` field stored when the appointment was created:

```javascript
// Saved during appointment booking
{
  locale: "de" // de, en, bg, pl, or tr
}
```

If no locale is found, it defaults to German (`de`).

## Implementation Details

### Files Modified

1. **Email Template**
   - `emailTemplates/appointmentCancellation.js` - New cancellation email template

2. **Translations**
   - `locales/de.json` - German translations
   - `locales/en.json` - English translations
   - `locales/bg.json` - Bulgarian translations
   - `locales/pl.json` - Polish translations
   - `locales/tr.json` - Turkish translations

3. **Mailer Service**
   - `services/mailer.js` - Added `sendAppointmentCancellation()` function

4. **Appointments Controller**
   - `controllers/appointments.js` - Integrated email sending on cancellation

5. **Appointment Model**
   - `models/Appointment.js` - Added `locale` field

### Code Example

```javascript
// In appointments controller - PATCH /api/appointments/:id
if (isCancelling) {
  try {
    const patientEmail = updatedAppointment.patientEmail;
    const locale = updatedAppointment.locale || "de";

    if (patientEmail) {
      const appointmentData = {
        doctorName: updatedAppointment.doctorId?.name || "N/A",
        date: updatedAppointment.date,
        slot: updatedAppointment.slot,
      };

      await sendAppointmentCancellation(patientEmail, appointmentData, locale);
      console.log(`✅ Cancellation email sent to ${patientEmail}`);
    }
  } catch (emailError) {
    console.error("❌ Error sending cancellation email:", emailError);
    // Don't fail the request if email fails
  }
}
```

## Testing

### Manual Testing

Use the test script to send a test cancellation email:

```bash
# Test in German (default)
node scripts/testCancellationEmail.js

# Test in English
node scripts/testCancellationEmail.js en

# Test in Bulgarian
node scripts/testCancellationEmail.js bg

# Test in Polish
node scripts/testCancellationEmail.js pl

# Test in Turkish
node scripts/testCancellationEmail.js tr
```

**Prerequisites**:
- Set `TEST_EMAIL` in your `.env` file
- Configure AWS SES credentials

### Testing from Dashboard

1. Create a test appointment from the website
2. Log in to the admin dashboard
3. Navigate to "Termine" (Appointments)
4. Click on an appointment to view details
5. Click "Absagen" (Cancel)
6. Optionally provide a cancellation reason
7. Confirm the cancellation
8. Check the patient's email inbox

## Environment Variables

Make sure these are configured in your `.env` file:

```env
# Practice Contact Information
PRACTICE_PHONE="+49 69 870015360"
PRACTICE_EMAIL="info@praxiskerim.de"
PRACTICE_WHATSAPP="+49 69 870015360"

# AWS SES Configuration
AWS_SES_KEY_ID="your-access-key-id"
AWS_SES_SECRET_KEY_ID="your-secret-access-key"
AWS_SES_FROM_EMAIL="info@praxiskerim.de"

# Testing
TEST_EMAIL="your-test-email@example.com"
```

## Translation Keys

All translations are stored in `locales/{locale}.json` under the `cancellationEmail` namespace:

```json
{
  "cancellationEmail": {
    "subject": "Terminabsage – Ihr geplanter Termin bei der Praxis Dr. Kerim",
    "greeting": "Sehr geehrte/r Patient/in,",
    "message": "leider müssen wir Ihnen mitteilen, dass Ihr geplanter Termin abgesagt wurde.",
    "appointmentDetails": "Abgesagter Termin",
    "doctor": "Arzt",
    "date": "Datum",
    "time": "Uhrzeit",
    "apology": "Wir bedauern die Unannehmlichkeiten sehr.",
    "rescheduleInfo": "Für weitere Informationen oder zur Vereinbarung eines neuen Termins...",
    "phone": "Telefon",
    "email": "E-Mail",
    "whatsapp": "WhatsApp-Kanal",
    "closing": "Vielen Dank für Ihr Verständnis...",
    "regards": "Mit freundlichen Grüßen",
    "practiceName": "Praxis Dr. Kerim"
  }
}
```

## Troubleshooting

### Email Not Sent

**Symptoms**: Appointment is cancelled but no email is received

**Possible Causes**:
1. No patient email stored in appointment
2. AWS SES credentials not configured
3. Email domain not verified in AWS SES
4. Network connectivity issues

**Solutions**:
```bash
# Check server logs for errors
tail -f logs/server.log | grep "cancellation"

# Test AWS SES connection
node scripts/testEmail.js

# Verify appointment has patient email
# Check MongoDB: db.appointments.find({ _id: "appointment-id" })
```

### Wrong Language

**Symptoms**: Email sent in wrong language

**Possible Causes**:
1. Locale not saved during appointment creation
2. Invalid locale value

**Solutions**:
- Check that the frontend sends `locale` during booking
- Verify locale is stored in appointment document
- Default locale is `"de"` if not specified

### Email in Spam

**Symptoms**: Email sent but goes to spam folder

**Solutions**:
1. Verify sender email domain in AWS SES
2. Add SPF and DKIM records to DNS
3. Whitelist sender email in test inbox

## Dashboard Integration

The "Absagen" button in the dashboard automatically triggers the cancellation flow:

**Location**: Dashboard → Termine → Appointment Details

**Actions**:
1. Updates appointment status to `"cancelled"`
2. Records cancellation timestamp
3. Saves cancellation reason (optional)
4. Sends cancellation email to patient
5. Updates dashboard view

## Best Practices

1. **Always provide a cancellation reason** when cancelling appointments
2. **Test cancellation emails** in all supported languages before production
3. **Monitor email delivery** using AWS SES dashboard
4. **Log all email attempts** for debugging and auditing
5. **Don't fail requests** if email sending fails (appointments should still be cancelled)

## Future Enhancements

Potential improvements:

- [ ] SMS notifications for cancelled appointments
- [ ] Automatic rescheduling suggestions
- [ ] Cancellation statistics in dashboard
- [ ] Patient-initiated cancellations from frontend
- [ ] Batch cancellation for doctor unavailability

## Support

For issues or questions:
- Check server logs: `tail -f logs/server.log`
- Test email system: `node scripts/testCancellationEmail.js`
- Review AWS SES console for delivery status
- Contact: info@praxiskerim.de

