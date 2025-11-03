# Multilingual Email Support for Appointment Confirmations

## Overview
The appointment confirmation email system now supports multiple languages based on the user's selection on the website. The email content, subject line, and date formatting are automatically translated to the user's preferred language.

## Supported Languages

The system supports 5 languages matching the website:

- **de** - German (Deutsch) - Default
- **en** - English
- **bg** - Bulgarian (Български)
- **pl** - Polish (Polski)
- **tr** - Turkish (Türkçe)

## How It Works

### 1. i18next Configuration

**File**: `/config/i18n.js`

The server uses i18next with filesystem backend to load translations from JSON files in the `/locales` directory.

### 2. Translation Files

**Directory**: `/locales/`

Each language has its own JSON file with all email translations:
- `de.json` - German translations
- `en.json` - English translations
- `bg.json` - Bulgarian translations
- `pl.json` - Polish translations
- `tr.json` - Turkish translations

### 3. Email Template

**File**: `/emailTemplates/appointmentConfirmation.js`

The template now:
- Accepts a `locale` parameter
- Uses i18n.t() to translate all text
- Formats dates according to the locale
- Sets the correct language in the HTML lang attribute

### 4. API Integration

**Endpoint**: `POST /api/appointments/book`

The website should include the user's selected language in the request:

```json
{
  "slot": {
    "doctorId": "...",
    "when": "2025-11-15T10:30:00.000Z"
  },
  "patient": {
    "name": "Max Mustermann",
    "email": "patient@example.com",
    "telefon": "+49 123 456789",
    // ... other patient data
  },
  "locale": "de"  // <- User's selected language
}
```

## Website Implementation

### From the Frontend (praxis-kerim-website)

When booking an appointment, the website should send the current locale from the language switcher:

```typescript
// Example in the appointment booking component
import { useTranslation } from 'react-i18next';

const BookingForm = () => {
  const { i18n } = useTranslation();
  
  const handleSubmit = async (appointmentData) => {
    const response = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slot: appointmentData.slot,
        patient: appointmentData.patient,
        locale: i18n.language, // <- Current user language (de, en, bg, pl, tr)
      }),
    });
    
    // Handle response...
  };
};
```

### Locale Detection

The system will:
1. Use the `locale` parameter from the request body
2. Default to **"de" (German)** if no locale is provided
3. Support all 5 languages: de, en, bg, pl, tr

## Email Content Translations

All email text is translated, including:

### Subject Line
- **de**: "Terminbestätigung - Praxis Kerim"
- **en**: "Appointment Confirmation - Praxis Kerim"
- **bg**: "Потвърждение на час - Praxis Kerim"
- **pl**: "Potwierdzenie wizyty - Praxis Kerim"
- **tr**: "Randevu Onayı - Praxis Kerim"

### Email Body
- Greeting
- Thank you message
- Appointment details labels (Doctor, Date, Time, Subject, Description)
- Important notes
- Practice contact information
- Closing/regards

### Date Formatting
Dates are formatted according to the locale:
- **de**: "Montag, 15. November 2025"
- **en**: "Monday, November 15, 2025"
- **bg**: "понеделник, 15 ноември 2025 г."
- **pl**: "poniedziałek, 15 listopada 2025"
- **tr**: "15 Kasım 2025 Pazartesi"

## Testing

### Test Email in Different Languages

```bash
# German
curl -X POST http://localhost:3030/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{
    "slot": { "doctorId": "...", "when": "2025-11-15T10:30:00.000Z" },
    "patient": { "name": "Test", "email": "test@example.com" },
    "locale": "de"
  }'

# English
curl -X POST http://localhost:3030/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{
    "slot": { "doctorId": "...", "when": "2025-11-15T10:30:00.000Z" },
    "patient": { "name": "Test", "email": "test@example.com" },
    "locale": "en"
  }'

# Bulgarian
curl -X POST http://localhost:3030/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{
    "slot": { "doctorId": "...", "when": "2025-11-15T10:30:00.000Z" },
    "patient": { "name": "Test", "email": "test@example.com" },
    "locale": "bg"
  }'

# Polish
curl -X POST http://localhost:3030/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{
    "slot": { "doctorId": "...", "when": "2025-11-15T10:30:00.000Z" },
    "patient": { "name": "Test", "email": "test@example.com" },
    "locale": "pl"
  }'

# Turkish
curl -X POST http://localhost:3030/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{
    "slot": { "doctorId": "...", "when": "2025-11-15T10:30:00.000Z" },
    "patient": { "name": "Test", "email": "test@example.com" },
    "locale": "tr"
  }'
```

## Adding New Translations

To add or modify translations:

1. Edit the appropriate language file in `/locales/`
2. Update the `appointmentEmail` section
3. Use the same key structure across all languages
4. Restart the server to load new translations

Example translation structure:

```json
{
  "appointmentEmail": {
    "subject": "Your translated subject",
    "title": "Your translated title",
    "greeting": "Your translated greeting",
    // ... more translations
  }
}
```

## Files Modified

1. **Created**:
   - `/config/i18n.js` - i18next configuration
   - `/locales/de.json` - German translations
   - `/locales/en.json` - English translations
   - `/locales/bg.json` - Bulgarian translations
   - `/locales/pl.json` - Polish translations
   - `/locales/tr.json` - Turkish translations

2. **Updated**:
   - `/emailTemplates/appointmentConfirmation.js` - Added i18n support
   - `/services/mailer.js` - Dynamic subject based on locale
   - `/controllers/appointments.js` - Accept and use locale parameter

## Benefits

- **Better User Experience**: Patients receive emails in their preferred language
- **Professional**: Shows respect for the diverse patient base
- **Consistency**: Email language matches the website language
- **Easy Maintenance**: All translations in centralized JSON files
- **Scalable**: Easy to add new languages in the future

## Notes

- If no locale is provided, the system defaults to German (de)
- The email HTML lang attribute is set dynamically based on locale
- All dates are formatted according to the locale's conventions
- The practice contact information remains the same across all languages

