# Multilingual Order Confirmation Email Setup

## Overview
The order confirmation email system now supports all 5 languages available on the website (German, English, Bulgarian, Polish, Turkish). The email language is automatically selected based on the user's language preference on the website.

## Changes Made

### 1. Translation Files Updated
All locale files now include order email translations:

- `/locales/de.json` - German translations
- `/locales/en.json` - English translations
- `/locales/bg.json` - Bulgarian translations
- `/locales/pl.json` - Polish translations
- `/locales/tr.json` - Turkish translations

Each file contains translations for:
- Email subject
- Greeting with patient name
- Order confirmation message
- Order details labels (order number, date, type, description)
- Important notes section
- Contact information
- Footer with practice details

### 2. Email Template Updated
**File**: `/emailTemplates/orderConfirmation.js`

Changes:
- Imported i18n configuration
- Added locale parameter with default value "de"
- Set language using `await i18n.changeLanguage(locale)`
- Added locale mapping for date formatting (de-DE, en-US, bg-BG, pl-PL, tr-TR)
- Replaced all hardcoded German text with `i18n.t()` translation calls
- Dynamic language attribute in HTML: `lang="${locale}"`

### 3. Mailer Service Updated
**File**: `/services/mailer.js`

Changes:
- Updated `sendOrderConfirmation()` function to accept locale parameter
- Added i18n language change before generating email subject
- Email subject now uses translated text: `i18nServer.t("orderEmail.subject")`

### 4. Orders Controller Updated
**File**: `/controllers/orders.js`

Changes:
- Added `locale` parameter to POST endpoint request body extraction
- Passed locale to `sendOrderConfirmation()` function
- Default to "de" if no locale provided
- Added locale to console log for debugging

### 5. Frontend Order Form Updated
**File**: `praxis-kerim-website/src/app/bestellung/OrderForm.tsx`

Changes:
- Extracted `lang` from `useI18n()` hook
- Added `locale: lang` to the order submission request body
- Sends user's selected language to the backend

## How It Works

1. **User Selects Language**: User chooses their preferred language on the website (de, en, bg, pl, or tr)

2. **Form Submission**: When user submits an order, the frontend includes the `locale` parameter in the request:
   ```typescript
   body: JSON.stringify({
     ...orderData,
     locale: lang, // Current language from i18n
   })
   ```

3. **Backend Processing**: The orders controller receives the locale and passes it to the email service

4. **Email Generation**: 
   - i18n changes language to the user's locale
   - Email template uses `i18n.t()` to get translated text
   - Date/time formatted according to locale conventions
   - Email sent in user's preferred language

## Testing

To test the multilingual email feature:

1. Change website language using the language selector
2. Fill out the order form
3. Submit the order
4. Check the email inbox - the confirmation email should be in the selected language

## Supported Languages

| Language   | Code | Date Format |
|-----------|------|-------------|
| German    | de   | de-DE       |
| English   | en   | en-US       |
| Bulgarian | bg   | bg-BG       |
| Polish    | pl   | pl-PL       |
| Turkish   | tr   | tr-TR       |

## Translation Keys

Order email translations use the `orderEmail` namespace:

```json
{
  "orderEmail": {
    "subject": "Email subject line",
    "previewText": "Preview text for email clients",
    "title": "Email title/heading",
    "greeting": "Greeting with patient name placeholder",
    "thankYou": "Thank you message",
    "confirmation": "Confirmation text",
    "processing": "Processing information",
    "notification": "Notification about next steps",
    "detailsTitle": "Order details section title",
    "orderNumber": "Order number label",
    "orderDate": "Order date label",
    "orderType": "Order type label",
    "description": "Description label",
    "importantTitle": "Important notes title",
    "deadlineNote": "Processing deadline note with placeholder",
    "contactTitle": "Contact section title",
    "phone": "Phone label",
    "email": "Email label",
    "whatsapp": "WhatsApp label",
    "regards": "Closing regards",
    "practiceName": "Practice name",
    "address": "Practice address",
    "footer": "Footer copyright with year placeholder"
  }
}
```

## Notes

- Default language is German ("de") if no locale is provided
- Email subject line is also translated based on locale
- Date and time formatting adapts to each locale's conventions
- All practice contact information (phone, email, WhatsApp) remains the same across languages
- The system gracefully handles missing translations by falling back to German

