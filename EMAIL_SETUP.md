# Email Configuration Setup

This guide explains how to configure email sending for user registration and password reset emails.

## 🚨 **Current Issue**

Emails are not being sent after registration because:

1. **AWS SES is not configured** with proper credentials
2. **Sender email is not verified** in AWS SES
3. **Development fallback** is auto-validating emails instead

## 🔧 **Quick Fix for Development**

### Option 1: Use Development Auto-Validation (Immediate)

Add this to your `telemedker-server/.env` file:

```env
NODE_ENV=development
```

This will:

- ✅ Auto-validate emails in development
- ✅ Skip email sending requirements
- ✅ Allow immediate login after registration

### Option 2: Configure AWS SES (Production Ready)

## 📧 **AWS SES Configuration**

### 1. **Create AWS SES Account**

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **Simple Email Service (SES)**
3. Choose your region (e.g., `eu-central-1`)

### 2. **Verify Your Sender Email**

1. In SES Console, go to **Verified Identities**
2. Click **Create Identity**
3. Choose **Email Address**
4. Enter: `info@telemediker.com` (or your domain email)
5. Click **Create Identity**
6. **Check your email** and click the verification link

### 3. **Get AWS Credentials**

1. Go to **IAM Console**
2. Create a new user with **SES permissions**
3. Generate **Access Key ID** and **Secret Access Key**

### 4. **Update Environment Variables**

Add to `telemedker-server/.env`:

```env
# AWS SES Configuration
AWS_SES_REGION=eu-central-1
AWS_SES_ACCESS_KEY_ID=your_access_key_here
AWS_SES_SECRET_ACCESS_KEY=your_secret_key_here

# Email Configuration
FRONTEND_DOMAIN=http://localhost:5173
```

### 5. **Test Email Sending**

Create a test script `test-email.js`:

```javascript
require("dotenv").config();
const { sendValidationEmail } = require("./services/mailer");

async function testEmail() {
  try {
    await sendValidationEmail("your-test@email.com", "test-token", "en");
    console.log("✅ Email sent successfully!");
  } catch (error) {
    console.error("❌ Email failed:", error.message);
  }
}

testEmail();
```

Run: `node test-email.js`

## 🔄 **Alternative Email Services**

### Option 3: Gmail SMTP (Simple Setup)

Update `telemedker-server/services/mailer.js`:

```javascript
// Replace AWS SES with Gmail SMTP
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your-email@gmail.com
    pass: process.env.EMAIL_PASS, // app-specific password
  },
});

async function sendValidationEmail(email, token, locale) {
  const validationUrl = `${process.env.FRONTEND_DOMAIN}/${locale}/validate-email?token=${token}`;

  const mailOptions = {
    from: `"Telemediker" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Email - Telemediker",
    html: `
      <h2>Welcome to Telemediker!</h2>
      <p>Please click the link below to verify your email:</p>
      <a href="${validationUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        Verify Email
      </a>
      <p>This link will expire in 1 hour.</p>
    `,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log("Email sent:", result.messageId);
  return result;
}
```

Add to `.env`:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## 🏃‍♂️ **Current Registration Flow**

### What Happens Now:

1. User fills registration form
2. ✅ **Success message shows for 4 seconds**
3. ✅ **"Continue to Login" button available**
4. Server tries to send email
5. 🔄 If email fails → auto-validates in development
6. User can login immediately (development) or needs email validation (production)

### Email Validation Status:

- ✅ **Development**: Auto-validated, immediate login
- ❌ **Production**: Requires email verification

## 🔍 **Debugging Email Issues**

### Check Server Logs:

```bash
cd telemedker-server
npm run dev
```

Look for:

- ✅ `"✅ Validation email sent successfully"`
- ⚠️ `"⚠️ Failed to send validation email, but registration continues"`
- 🔧 `"🔧 Development mode: Email auto-validated"`

### Common Issues:

1. **"Email address is not verified"**

   - Verify sender email in AWS SES Console

2. **"Invalid credentials"**

   - Check AWS keys in `.env` file

3. **"Region not found"**

   - Verify `AWS_SES_REGION` setting

4. **"Rate exceeded"**
   - AWS SES has sending limits for new accounts

## 🎯 **Recommended Setup**

### For Development:

```env
NODE_ENV=development
# Emails will be auto-validated
```

### For Production:

```env
NODE_ENV=production
AWS_SES_REGION=eu-central-1
AWS_SES_ACCESS_KEY_ID=your_key
AWS_SES_SECRET_ACCESS_KEY=your_secret
FRONTEND_DOMAIN=https://yourdomain.com
```

## ✅ **Verification**

After setup, test the flow:

1. **Register new account**
2. **See success message** (4 seconds)
3. **Check email** (production) or **auto-login** (development)
4. **Verify account** and login

The registration flow is now **user-friendly** with clear messaging and **flexible email configuration**!
