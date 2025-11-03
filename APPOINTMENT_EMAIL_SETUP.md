# Appointment Confirmation Email Setup

## Overview
This document outlines the implementation of the appointment confirmation email system that sends automated emails to patients after they book an appointment.

## Email Configuration
- **From Email**: `info@praxiskerim.de` (verified in AWS SES)
- **Service**: AWS SES (Simple Email Service)
- **Region**: eu-north-1 (Stockholm)
- **Template Language**: German (default)

## Files Modified/Created

### 1. Email Template
**File**: `/emailTemplates/appointmentConfirmation.js`
- Created new email template using existing email parts (header, footer, head)
- Professional design with appointment details in a formatted table
- Includes important patient instructions
- Uses the same branding as existing email templates

### 2. Mailer Service
**File**: `/services/mailer.js`
- Added `sendAppointmentConfirmation()` function
- Sends from `info@praxiskerim.de`
- Default subject: "Terminbestätigung - Praxis Kerim"
- Supports locale parameter (default: 'de')

### 3. Appointment Model
**File**: `/models/Appointment.js`
- Added `patientEmail` field (required, validated email format)
- Added `patientName` field (optional)
- Added `patientPhone` field (optional)

### 4. Appointment Controller
**File**: `/controllers/appointments.js`
- Updated validation rules to include patient information
- Modified POST endpoint to accept patient email, name, and phone
- Integrated email sending after successful appointment creation
- Email failures are logged but don't block appointment creation

## Email Content

The confirmation email includes:
- **Header**: Praxis Kerim branding
- **Title**: "Terminbestätigung" (Appointment Confirmation)
- **Greeting**: Professional German greeting
- **Appointment Details Table**:
  - Doctor name
  - Date (formatted in German)
  - Time slot
  - Title (if provided)
  - Description (if provided)
- **Important Instructions**:
  - Arrive 10 minutes early
  - Bring insurance card
  - Cancel at least 24 hours in advance if needed
- **Contact Information**: Practice phone and email
- **Footer**: Social media links and legal information

## API Changes

### POST /api/appointments
**New Required Field**:
- `patientEmail` (string, email format)

**New Optional Fields**:
- `patientName` (string, 2-100 characters)
- `patientPhone` (string, max 20 characters)

**Example Request**:
```json
{
  "doctorId": "507f1f77bcf86cd799439011",
  "date": "2025-11-15",
  "slot": "10:30",
  "patientEmail": "patient@example.com",
  "patientName": "Max Mustermann",
  "patientPhone": "+49 123 456789",
  "title": "Routine Checkup",
  "description": "Annual health checkup"
}
```

## Environment Variables Required

Ensure these are set in your `.env` file:
```
AWS_SES_ACCESS_KEY_ID=your_access_key
AWS_SES_SECRET_ACCESS_KEY=your_secret_key
SERVER_URL=http://localhost:3030
```

**Note**: `SERVER_URL` is used by the email templates to reference the Praxis Kerim logo served from the server's public folder. In production, set this to your actual server URL (e.g., `https://api.praxiskerim.de`).

## Testing

To test the email system:

1. **Create a test appointment**:
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "YOUR_DOCTOR_ID",
    "date": "2025-11-15",
    "slot": "10:30",
    "patientEmail": "test@example.com",
    "patientName": "Test Patient",
    "title": "Test Appointment"
  }'
```

2. **Check server logs** for email confirmation:
```
Appointment confirmation email sent to: test@example.com
```

3. **Check patient email** for the confirmation message

## Error Handling

- Email sending errors are caught and logged
- Failed email delivery doesn't prevent appointment creation
- Patients can still view their appointment in the dashboard even if email fails

## Customization

### Change Email Locale
Modify the locale parameter in `/controllers/appointments.js`:
```javascript
await sendAppointmentConfirmation(
  patientEmail,
  appointmentData,
  'en' // Change to desired locale
);
```

### Update Practice Information
Edit the contact information in `/emailTemplates/appointmentConfirmation.js`:
- Phone number
- Email address
- Practice name

### Modify Email Design
The email uses shared components:
- `/emailTemplates/emailParts/head.js` - Email styles
- `/emailTemplates/emailParts/header.js` - Logo and branding (uses Praxis Kerim logo from `/public/images/logo.png`)
- `/emailTemplates/emailParts/footer.js` - Footer with social links

**Logo**: The Praxis Kerim logo is served from the server's `/public/images/` directory. To update it, replace `/public/images/logo.png` with your new logo file.

## Notes

- The system uses the same AWS SES configuration as other emails
- Email is sent asynchronously and won't block the appointment creation
- Patient data is now stored with appointments for future communication
- All email addresses are normalized to lowercase for consistency

