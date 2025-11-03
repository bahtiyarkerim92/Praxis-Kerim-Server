# Order Confirmation Email Setup

## Overview
This document outlines the implementation of the order confirmation email system that sends automated emails to patients after they place an order through the practice platform.

## Email Configuration
- **From Email**: `info@praxiskerim.de` (verified in AWS SES)
- **Service**: AWS SES (Simple Email Service)
- **Region**: eu-north-1 (Stockholm)
- **Template Language**: German (default)

## Files Created/Modified

### 1. Email Template
**File**: `/emailTemplates/orderConfirmation.js`
- New email template using existing email parts (header, footer, head)
- Professional design with order details in a formatted table
- Includes practice contact information (phone, email, WhatsApp)
- Uses the same branding as existing email templates

### 2. Mailer Service
**File**: `/services/mailer.js`
- Added `sendOrderConfirmation()` function
- Sends from `info@praxiskerim.de`
- Subject: "Eingangsbestätigung Ihrer Bestellung – Praxis Dr. Kerim"
- Supports locale parameter (default: 'de')

### 3. Order Controller
**File**: `/controllers/orders.js`
- Integrated email sending after successful order creation
- Email failures are logged but don't block order creation
- Automatically formats order data for email template

## Email Content

The confirmation email includes:
- **Header**: Praxis Dr. Kerim branding (no logo as per current configuration)
- **Title**: "Eingangsbestätigung" (Order Confirmation)
- **Greeting**: Professional German greeting with patient name
- **Order Details Table**:
  - Order number (ID)
  - Order date and time (formatted in German)
  - Order type
  - Description (if provided)
- **Processing Information**:
  - Confirmation that the order has been received
  - Information about processing timeline
  - Notification about upcoming status updates
- **Important Notes**:
  - Order deadline time (configurable via env var)
  - Processing time (1-2 business days)
- **Contact Information**: 
  - Phone: Clickable phone link
  - Email: Clickable email link
  - WhatsApp: Clickable WhatsApp link
- **Practice Address**: 
  - Jacques-Offenbach-Straße 12
  - 63069 Offenbach am Main
- **Footer**: Social media links and legal information

## API Integration

### POST /api/orders
When a new order is created, the system automatically:
1. Saves the order to the database
2. Formats the order data for the email template
3. Sends confirmation email to `patient.email`
4. Logs success or failure (errors don't block order creation)

**Order Data Used**:
- `patient.email` - Recipient email address
- `patient.vorname` + `patient.nachname` - Patient name
- `orders[].type` - Order types
- `orders[].details` - Order details/description
- `createdAt` - Order creation timestamp
- `_id` - Order ID (used as order number)

## Environment Variables Required

Ensure these are set in your `.env` file:
```env
# AWS SES Configuration
AWS_SES_ACCESS_KEY_ID=your_access_key
AWS_SES_SECRET_ACCESS_KEY=your_secret_key

# Practice Information
PRACTICE_PHONE=+49 69 870015360
PRACTICE_EMAIL=info@praxiskerim.de
PRACTICE_WHATSAPP=+49 69 870015360
ORDER_DEADLINE=14:00
```

### Environment Variable Details:
- `PRACTICE_PHONE` - Phone number displayed in email (with country code)
- `PRACTICE_EMAIL` - Contact email displayed in email
- `PRACTICE_WHATSAPP` - WhatsApp number (with country code, used for wa.me link)
- `ORDER_DEADLINE` - Cutoff time for same-day processing (format: HH:MM)

## Testing

To test the email system:

1. **Create a test order**:
```bash
curl -X POST http://localhost:3030/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {
      "vorname": "Max",
      "nachname": "Mustermann",
      "telefon": "+49 123 456789",
      "email": "test@example.com",
      "strasse": "Teststraße",
      "hausnummer": "1",
      "plz": "12345",
      "stadt": "Berlin",
      "versicherungsart": "gesetzlich",
      "versicherungsnummer": "T123456789"
    },
    "orders": [
      {
        "type": "Rezept",
        "details": "Medication X"
      }
    ]
  }'
```

2. **Check server logs** for email confirmation:
```
Order confirmation email sent to: test@example.com
```

3. **Check patient email** for the confirmation message

## Error Handling

- Email sending errors are caught and logged
- Failed email delivery doesn't prevent order creation
- Patients can still view their order in the system even if email fails
- Order creation API returns success regardless of email status

## Customization

### Change Practice Information
Update the environment variables in `.env`:
```env
PRACTICE_PHONE=+49 XX XXXXXXXX
PRACTICE_EMAIL=contact@yourpractice.de
PRACTICE_WHATSAPP=+49 XX XXXXXXXX
ORDER_DEADLINE=15:00
```

### Update Email Content
Edit the content in `/emailTemplates/orderConfirmation.js`:
- Processing information
- Important notes
- Practice address
- Contact instructions

### Modify Email Design
The email uses shared components:
- `/emailTemplates/emailParts/head.js` - Email styles
- `/emailTemplates/emailParts/header.js` - Branding (currently no logo)
- `/emailTemplates/emailParts/footer.js` - Footer with social links

## Notes

- The system uses the same AWS SES configuration as other emails
- Email is sent asynchronously and won't block the order creation
- Patient email is normalized to lowercase for consistency
- Order confirmation emails are sent only for new orders, not for status updates
- The order number in the email is the MongoDB document ID

## Future Enhancements

Possible improvements:
- Add status update emails when order status changes
- Add ready-for-pickup notification email
- Support for multiple languages (currently German only)
- PDF attachment with order details
- Add logo to email header if desired

