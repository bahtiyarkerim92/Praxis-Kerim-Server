# Appointment Reschedule Email System

## Overview

When a patient reschedules their appointment through the appointment management page, they automatically receive a confirmation email in their selected language with the NEW appointment details and a NEW management link. The old management link is automatically invalidated for security.

## Features

✅ **Multilingual Support**: Available in German, English, Bulgarian, Polish, and Turkish  
✅ **New Management Token**: Each reschedule generates a new secure token  
✅ **Old Token Invalidation**: Previous management links become invalid after rescheduling  
✅ **Professional Design**: Uses the same template design as other emails  
✅ **Appointment Details**: Shows doctor name, new date, and new time

## How It Works

### 1. **Patient Reschedules Appointment**
- Patient clicks on appointment management link from their confirmation email
- Selects a new date and time slot
- Submits the reschedule request

### 2. **Server Processing**
- Validates the new time slot is available
- Generates a **NEW** management token using `crypto.randomBytes(32).toString("hex")`
- Updates the appointment with new date, time, and token
- **Invalidates** the old management token
- Sends reschedule confirmation email with the NEW token

### 3. **Email Notification**
- Patient receives reschedule confirmation email in their language
- Email includes:
  - Confirmation of successful reschedule
  - NEW appointment details (doctor, date, time)
  - NEW management link with the new token
  - Option to reschedule or cancel again

## Technical Implementation

### Email Template
**File**: `telemedker-server/emailTemplates/appointmentReschedule.js`

### Translations
**Files**: `telemedker-server/locales/{de,en,bg,pl,tr}.json`

**Namespace**: `rescheduleEmail`

Available keys:
- `subject`: Email subject line
- `title`: Main heading
- `greeting`: Email greeting
- `message`: Reschedule confirmation message
- `newAppointmentDetails`: Section header for appointment info
- `doctor`: Doctor label
- `date`: Date label
- `time`: Time label
- `manageTitle`: Management section title
- `manageDescription`: Instructions for managing appointment
- `manageButton`: Button text for management link
- `lookingForward`: Closing message
- `regards`: Sign-off
- `practiceName`: Practice name
- `footer`: Footer text

### Mailer Function
**File**: `telemedker-server/services/mailer.js`

**Function**: `sendAppointmentReschedule(email, appointmentData, locale)`

**Parameters**:
- `email` (string): Patient's email address
- `appointmentData` (object):
  - `doctorName` (string): Name of the doctor
  - `date` (Date): Appointment date
  - `slot` (string): Time slot (HH:MM format)
  - `managementToken` (string): NEW secure token for appointment management
- `locale` (string): Language code ('de', 'en', 'bg', 'pl', 'tr')

### API Endpoint
**File**: `telemedker-server/controllers/appointmentManagement.js`

**Endpoint**: `PATCH /api/appointment-management/:token/reschedule`

**Process**:
1. Validates the current management token
2. Checks if new time slot is available
3. Generates NEW management token (32-byte hex string)
4. Updates appointment with new date, time, and token
5. Sends reschedule email with NEW token
6. Returns success response

## Security

### Token Invalidation
- **Old token is replaced**: When an appointment is rescheduled, the old `managementToken` is completely replaced with a new one
- **Previous links stop working**: Any old management links become invalid immediately
- **Fresh link in email**: The reschedule confirmation email contains only the NEW management link

### Token Format
- Generated using Node.js `crypto.randomBytes(32).toString("hex")`
- 64-character hexadecimal string
- Cryptographically secure random generation
- Unique per appointment

## Testing

### Manual Test Script
**File**: `telemedker-server/scripts/testRescheduleEmail.js`

**Usage**:
```bash
cd telemedker-server
node scripts/testRescheduleEmail.js
```

**Configuration**:
1. Open the script file
2. Change `testEmail` to your email address
3. Run the script to receive test emails in all languages

### Test All Emails
You can also use the comprehensive test script:
```bash
node scripts/testAllEmails.js
```

## Email Content Examples

### German (de)
**Subject**: Termin verschoben – Praxis Dr. Kerim  
**Message**: "Ihr Termin wurde erfolgreich verschoben. Hier sind Ihre neuen Termindetails:"

### English (en)
**Subject**: Appointment Rescheduled – Praxis Dr. Kerim  
**Message**: "Your appointment has been successfully rescheduled. Here are your new appointment details:"

### Bulgarian (bg)
**Subject**: Часът е пренасрочен – Praxis Dr. Kerim  
**Message**: "Вашият час е успешно пренасрочен. Ето новите детайли за Вашия час:"

### Polish (pl)
**Subject**: Wizyta przełożona – Praxis Dr. Kerim  
**Message**: "Twoja wizyta została pomyślnie przełożona. Oto nowe szczegóły Twojej wizyty:"

### Turkish (tr)
**Subject**: Randevu Ertelendi – Praxis Dr. Kerim  
**Message**: "Randevunuz başarıyla ertelendi. İşte yeni randevu bilgileriniz:"

## Workflow Diagram

```
Patient clicks "Reschedule" in management page
              ↓
Patient selects new date & time
              ↓
Submits reschedule request with OLD token
              ↓
Server validates OLD token
              ↓
Server checks new slot availability
              ↓
Server generates NEW management token
              ↓
Server updates appointment:
  - New date
  - New time
  - NEW token (old token INVALID)
              ↓
Server sends reschedule email:
  - Confirmation message
  - New appointment details
  - NEW management link
              ↓
Patient receives email with NEW link
              ↓
Old management link STOPS WORKING
              ↓
Patient can use NEW link for future changes
```

## Monitoring

### Success Log
```
✅ Reschedule email sent to patient@example.com
```

### Error Log
```
❌ Error sending reschedule email: <error details>
⚠️ No patient email found, skipping reschedule email
```

## Related Documentation

- [Appointment Management Setup](./APPOINTMENT_MANAGEMENT_SETUP.md)
- [Appointment Confirmation Email](./appointmentConfirmation.js)
- [Appointment Cancellation Email](./APPOINTMENT_CANCELLATION_SETUP.md)

## Support

For issues or questions about the reschedule email system:
1. Check server logs for error messages
2. Verify email is being sent via AWS SES
3. Confirm translations are loaded correctly
4. Test with the provided test script

## Environment Variables

No additional environment variables required. Uses existing configuration:
- `AWS_SES_KEY_ID`: AWS SES access key
- `AWS_SES_SECRET_KEY_ID`: AWS SES secret key
- `WEBSITE_URL`: Base URL for management links (defaults to https://praxiskerim.de)

