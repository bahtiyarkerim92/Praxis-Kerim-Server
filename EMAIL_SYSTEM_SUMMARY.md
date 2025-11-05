# Email System Summary

## Overview

The Praxis Kerim server has a complete multilingual email system supporting 5 languages (German, English, Bulgarian, Polish, Turkish) across multiple email types for appointment and order management.

## Email Types

### 1. Appointment Confirmation

**Template**: `emailTemplates/appointmentConfirmation.js`  
**Function**: `sendAppointmentConfirmation(email, appointmentData, locale)`  
**Purpose**: Sent immediately after a patient books an appointment.  
**Features**:

- Multilingual (all 5 languages)
- Displays appointment details (doctor, date, time, subject, description)
- Important notes for patients
- Practice contact information

### 2. Order Confirmation

**Template**: `emailTemplates/orderConfirmation.js`  
**Function**: `sendOrderConfirmation(email, orderData, locale)`  
**Purpose**: Sent immediately after a patient places an order for documents.  
**Features**:

- Multilingual (all 5 languages)
- Displays order details (number, date, type, description)
- Processing time information
- Practice contact information

### 3. Appointment Reminder

**Template**: `emailTemplates/appointmentReminder.js`  
**Function**: `sendAppointmentReminder(email, appointmentData, reminderType, locale)`  
**Purpose**: Sent automatically before appointments (24h or 2h).  
**Features**:

- Multilingual (all 5 languages)
- Single template for both 24-hour and 2-hour reminders
- Appointment details with localized date/time
- Cancellation information
- Special note about video consultations

## Supported Languages

| Code | Language  | Native Name |
| ---- | --------- | ----------- |
| de   | German    | Deutsch     |
| en   | English   | English     |
| bg   | Bulgarian | Български   |
| pl   | Polish    | Polski      |
| tr   | Turkish   | Türkçe      |

## Translation System

### i18next Configuration

**File**: `config/i18n.js`

Uses `i18next` with `i18next-fs-backend` to load translations from JSON files.

### Translation Files

Located in `/locales/`:

- `de.json` - German translations
- `en.json` - English translations
- `bg.json` - Bulgarian translations
- `pl.json` - Polish translations
- `tr.json` - Turkish translations

Each file contains three namespaces:

1. `appointmentEmail` - Appointment confirmation email
2. `orderEmail` - Order confirmation email
3. `reminderEmail` - Appointment reminder email

## Frontend Integration

### Appointment Booking

**File**: `praxis-kerim-website/src/app/terminbuchung/NewBookingForm.tsx`

Sends user's selected language with booking request:

```typescript
body: JSON.stringify({
  slot: selectedSlot,
  patient: formData,
  locale: lang, // User's language
});
```

### Order Submission

**File**: `praxis-kerim-website/src/app/bestellung/OrderForm.tsx`

Sends user's selected language with order:

```typescript
body: JSON.stringify({
  ...orderData,
  locale: lang, // User's language
});
```

## Backend Processing

### Appointments Controller

**File**: `controllers/appointments.js`

Extracts `locale` from request and passes it to email service:

```javascript
const locale = req.body.locale || "de";
await sendAppointmentConfirmation(patient.email, appointmentData, locale);
```

### Orders Controller

**File**: `controllers/orders.js`

Extracts `locale` from request and passes it to email service:

```javascript
const emailLocale = locale || "de";
await sendOrderConfirmation(patient.email, orderData, emailLocale);
```

## Email Service

**File**: `services/mailer.js`

Central service for all email operations using AWS SES.

### Exported Functions

```javascript
// Appointment confirmation (multilingual)
sendAppointmentConfirmation(email, appointmentData, (locale = "de"));

// Order confirmation (multilingual)
sendOrderConfirmation(email, orderData, (locale = "de"));

// Order ready notification (multilingual)
sendOrderReady(email, orderData, (locale = "de"));

// Appointment reminder (multilingual)
sendAppointmentReminder(
  email,
  appointmentData,
  (reminderType = "24h"),
  (locale = "de")
);

// Appointment cancellation by admin (multilingual)
sendAppointmentCancellation(email, appointmentData, (locale = "de"));

// Appointment reschedule confirmation (multilingual)
sendAppointmentReschedule(email, appointmentData, (locale = "de"));

// Patient cancellation confirmation (multilingual)
sendPatientCancellationConfirmation(email, appointmentData, (locale = "de"));
```

## Environment Variables

Required variables in `.env`:

```env
# AWS SES Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-north-1

# Practice Information
PRACTICE_PHONE=+49 69 870015360
PRACTICE_EMAIL=info@praxiskerim.de
PRACTICE_WHATSAPP=+49 69 870015360

# Order Processing
ORDER_DEADLINE=14
```

## Testing

### Test Scripts

1. **Appointment Confirmation Email**

   ```bash
   node scripts/testEmail.js your-email@example.com
   ```

2. **Order Confirmation Email**

   - Use the order form on the website
   - Or manually trigger via `sendOrderConfirmation()`

3. **Appointment Reminder Email**
   ```bash
   node scripts/testReminderEmail.js your-email@example.com
   ```

## Email Template Structure

All email templates follow a consistent structure:

1. **Head Section** (`emailParts/head.js`)

   - Meta tags
   - Responsive styles
   - Email client compatibility

2. **Header Section** (`emailParts/header.js`)

   - Practice branding
   - Consistent across all emails

3. **Main Content**

   - Dynamic based on email type
   - Fully translated
   - Locale-specific date/time formatting

4. **Footer Section** (`emailParts/footer.js`)
   - Copyright information
   - Year placeholder

## Key Features

### 1. Locale-Aware Date Formatting

Dates and times are formatted according to each locale:

- German: `Montag, 4. November 2025, 10:00`
- English: `Monday, November 4, 2025, 10:00 AM`
- Bulgarian: `понеделник, 4 ноември 2025 г., 10:00`
- Polish: `poniedziałek, 4 listopada 2025, 10:00`
- Turkish: `Pazartesi, 4 Kasım 2025, 10:00`

### 2. Graceful Fallbacks

- Missing locale defaults to German (`de`)
- Missing translations fall back to German text
- System continues to work even if translations are incomplete

### 3. Error Handling

- Failed email sends are logged but don't block operations
- Orders and appointments are still created even if email fails
- Detailed error messages in console

### 4. Email Client Compatibility

- Works across major email clients (Gmail, Outlook, Apple Mail, etc.)
- Mobile-responsive design
- Proper encoding for special characters in all languages

## Documentation Files

1. `MULTILINGUAL_EMAIL_SETUP.md` - Appointment confirmation multilingual setup
2. `WEBSITE_LOCALE_INTEGRATION.md` - Frontend integration guide
3. `MULTILINGUAL_ORDER_EMAIL_SETUP.md` - Order confirmation multilingual setup
4. `APPOINTMENT_REMINDER_SETUP.md` - Reminder email setup and automation guide
5. `EMAIL_SYSTEM_SUMMARY.md` - This file (complete overview)

## Future Enhancements

### Recommended Additions

1. **Automated Reminder Scheduling**

   - Implement cron job to send 24h and 2h reminders
   - Track sent reminders in database
   - Handle time zones properly

2. **Email Templates Management**

   - Admin interface to edit email templates
   - Preview emails before sending
   - A/B testing for email effectiveness

3. **Email Analytics**

   - Track open rates
   - Track click-through rates
   - Monitor delivery failures

4. **Additional Email Types**

   - Appointment cancellation confirmation
   - Order ready for pickup notification
   - Follow-up surveys

5. **Email Preferences**
   - Allow patients to opt-out of reminders
   - Choose preferred reminder timing
   - Email frequency preferences

## Maintenance

### Adding a New Language

1. Create new locale file: `/locales/{lang}.json`
2. Copy structure from `de.json`
3. Translate all keys
4. Add locale mapping in email templates:
   ```javascript
   const localeMap = {
     de: "de-DE",
     en: "en-US",
     // Add new language
     fr: "fr-FR",
   };
   ```
5. Update i18n config to include new language
6. Test all email types in new language

### Updating Email Content

1. Update translation keys in `/locales/{lang}.json`
2. If HTML structure changes, update email template
3. Test email across all languages
4. Preview in multiple email clients

### Troubleshooting

Common issues and solutions:

1. **Emails not sending**

   - Check AWS SES credentials
   - Verify sender email is verified in SES
   - Check AWS SES sending limits

2. **Wrong language in email**

   - Verify locale is being sent from frontend
   - Check backend console logs for locale value
   - Verify translation files exist

3. **Formatting issues**

   - Test in multiple email clients
   - Validate HTML structure
   - Check for unclosed tags

4. **Missing translations**
   - Check translation keys match in all locale files
   - Verify i18n is initialized before sending
   - Look for console warnings about missing keys

## Contact

For questions or issues with the email system, contact the development team or refer to the individual documentation files for each email type.
