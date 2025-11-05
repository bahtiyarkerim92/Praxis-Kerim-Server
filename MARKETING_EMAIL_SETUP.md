# Marketing Email System

## Overview
The marketing email system allows admins to send custom HTML emails to patients for promotional or informational purposes using AWS SES.

## Features
- ✅ Send emails to selected patients or all patients
- ✅ HTML content support for rich formatting
- ✅ Multilingual support (de, en, bg, pl, tr)
- ✅ Uses consistent email design (same header/footer as other emails)
- ✅ Parallel sending with error handling
- ✅ Progress tracking and statistics

## Usage

### From Dashboard UI
1. Navigate to "Patienten" page
2. Select patients using checkboxes OR choose "Alle" option
3. Click "E-Mail senden" button
4. Fill in:
   - Language selection
   - Subject line
   - HTML content (with formatting)
5. Confirm and send

### From Command Line (Testing)
```bash
# Send example email to all patients in German (default)
node scripts/testMarketingEmail.js

# Send in English
node scripts/testMarketingEmail.js en

# Send in Bulgarian
node scripts/testMarketingEmail.js bg

# Send in Polish
node scripts/testMarketingEmail.js pl

# Send in Turkish
node scripts/testMarketingEmail.js tr
```

## Email Template
The marketing emails use:
- **Head**: Standard email styles with responsive design
- **Header**: Praxis Dr. Kerim branding (no logo as per request)
- **Content**: Free HTML content provided by admin
- **Footer**: Practice information and copyright

## API Endpoint

### Send Bulk Email
**POST** `/api/patients/send-bulk-email`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**
```json
{
  "patientIds": ["id1", "id2"],  // Array of patient IDs to send to
  "sendToAll": false,             // Or true to send to all patients
  "subject": "Your Subject",      // Email subject line
  "content": "<p>HTML content</p>", // HTML email body
  "locale": "de"                  // Language: de, en, bg, pl, tr
}
```

**Response:**
```json
{
  "success": true,
  "message": "E-Mails gesendet: 50 erfolgreich, 2 fehlgeschlagen",
  "stats": {
    "total": 52,
    "successful": 50,
    "failed": 2
  }
}
```

## HTML Content Examples

### Simple Text with Formatting
```html
<p>Liebe Patientinnen und Patienten,</p>
<p><strong>wichtige Ankündigung:</strong> Unsere Praxis hat neue Öffnungszeiten.</p>
<ul>
  <li>Montag - Freitag: 08:00 - 18:00</li>
  <li>Samstag: 09:00 - 13:00</li>
</ul>
```

### Styled Box with Information
```html
<div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #0066cc;">
  <p style="margin: 0; font-weight: bold; color: #0066cc;">Wichtig:</p>
  <p style="margin: 10px 0 0 0;">Ihre Nachricht hier...</p>
</div>
```

### Links and Contact Info
```html
<p>Besuchen Sie unsere Website: 
  <a href="https://praxiskerim.de" style="color: #0066cc;">praxiskerim.de</a>
</p>
<p>
  📞 Telefon: +49 69 123456<br/>
  📧 E-Mail: info@praxiskerim.de
</p>
```

## Best Practices

1. **Subject Lines**
   - Keep under 50 characters
   - Be clear and specific
   - Avoid spam trigger words

2. **Content**
   - Use inline styles (external CSS won't work in emails)
   - Keep it concise and scannable
   - Include a clear call-to-action
   - Test HTML rendering before sending to all

3. **Sending**
   - Always test with a small group first
   - Use appropriate language for your audience
   - Double-check content for typos
   - Consider timing (avoid late night sends)

4. **AWS SES Limits**
   - Be aware of your sending limits
   - The script includes small delays between sends
   - Monitor bounce rates in AWS console

## Files
- **Template**: `emailTemplates/marketingEmail.js`
- **Service**: `services/mailer.js` (`sendMarketingEmail()`)
- **Controller**: `controllers/patients.js` (`/send-bulk-email`)
- **Frontend**: `telemedker-dashboard/src/views/PatientsView.vue`
- **Test Script**: `scripts/testMarketingEmail.js`

## Troubleshooting

### Emails not sending
- Check AWS SES credentials in `.env`
- Verify AWS SES is out of sandbox mode
- Check email addresses are verified (if in sandbox)

### Failed sends
- Check patient email addresses are valid
- Monitor AWS SES bounce/complaint rates
- Review server logs for specific errors

### HTML not rendering
- Use inline styles only
- Test with simple HTML first
- Avoid complex CSS (flexbox, grid, etc.)
- Keep images hosted externally

## Environment Variables
```env
AWS_SES_KEY_ID=your_key_id
AWS_SES_SECRET_KEY_ID=your_secret_key
PRACTICE_PHONE=+49 69 123456
PRACTICE_EMAIL=info@praxiskerim.de
PRACTICE_WHATSAPP=+49 69 123456
```

