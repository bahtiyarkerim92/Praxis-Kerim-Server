# Environment Setup Guide

## Required Environment Variables

Create a `.env` file in the server root with the following variables:

### Server Configuration

```
PORT=3030
NODE_ENV=development
SERVER_URL=http://localhost:3030
```

- `SERVER_URL` is used for email templates to reference server assets (like the logo) in production
- In development, emails use the public website URL since email clients can't access localhost
- In production, set this to your actual server URL (e.g., `https://api.praxiskerim.de`) and set `NODE_ENV=production`

### Database

```
DB_CONNECTION_STRING=mongodb://localhost:27017/telemedker
```

- MongoDB connection string
- Make sure MongoDB is running locally or use a cloud MongoDB service

### JWT Secrets

```
ACCESS_TOKEN_SECRET=your-access-token-secret-here
REFRESH_TOKEN_SECRET=your-refresh-token-secret-here
```

- Use strong random strings (at least 32 characters)
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **IMPORTANT:** Keep these secret and different in production!

### Admin Account (Optional)

```
ADMIN_EMAIL=admin@telemedker.com
ADMIN_PASSWORD=Admin123!
ADMIN_NAME=Admin
```

- Used by the `createAdmin.js` script
- Change the password after first login in production

### Practice Information (For Email Templates)

```
PRACTICE_PHONE=+49 69 870015360
PRACTICE_EMAIL=info@praxiskerim.de
PRACTICE_WHATSAPP=+49 69 870015360
ORDER_DEADLINE=14:00
```

- Used in order confirmation emails
- `ORDER_DEADLINE` is the cutoff time for same-day order processing
- `PRACTICE_WHATSAPP` should include country code for WhatsApp link

### Appointment Reminder Scheduler (Optional)

```
REMINDER_CHECK_INTERVAL=*/30 * * * *
ENABLE_24H_REMINDERS=true
ENABLE_2H_REMINDERS=true
```

- `REMINDER_CHECK_INTERVAL`: Cron expression for how often to check for reminders (default: every 30 minutes)
  - Examples: `*/15 * * * *` (every 15 min), `0 * * * *` (every hour), `0 */2 * * *` (every 2 hours)
- `ENABLE_24H_REMINDERS`: Send 24-hour reminders (default: true)
- `ENABLE_2H_REMINDERS`: Send 2-hour reminders (default: true)
- Set to `false` to disable a specific reminder type
- Reminders are automatically sent in the patient's selected language

## Setup Steps

1. **Copy the example file:**

   ```bash
   cp .env.example .env
   ```

2. **Generate JWT secrets:**

   ```bash
   node -e "console.log('ACCESS_TOKEN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('REFRESH_TOKEN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Update MongoDB connection:**

   - If using local MongoDB: `mongodb://localhost:27017/telemedker`
   - If using MongoDB Atlas: Get connection string from Atlas dashboard

4. **Create admin account:**
   ```bash
   npm run create-admin
   # or
   node scripts/createAdmin.js
   ```

## What Was Removed

The following environment variables are **NO LONGER NEEDED** (removed features):

### ❌ Email Service (Removed)

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- `EMAIL_FROM`
- `EMAIL_TOKEN_SECRET` (not used anymore)

### ❌ AWS S3 (Removed)

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET_NAME`
- `AWS_S3_BUCKET_REGION`

### ❌ Daily.co Video (Removed)

- `DAILY_API_KEY`
- `DAILY_DOMAIN`

### ❌ Payment Integration (Removed)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Any payment-related keys

### ❌ Other Removed Features

- Any file transfer related keys
- Analytics keys
- Newsletter/marketing service keys

## Minimal Production .env Example

```env
# Server
PORT=3030
NODE_ENV=production
SERVER_URL=https://api.praxiskerim.de

# Database
DB_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/telemedker

# JWT Secrets (Use actual random secrets!)
ACCESS_TOKEN_SECRET=<generate-32-byte-random-hex>
REFRESH_TOKEN_SECRET=<generate-32-byte-random-hex>

# Admin (Optional)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password>
ADMIN_NAME=Admin

# Practice Information (For Email Templates)
PRACTICE_PHONE=+49 69 870015360
PRACTICE_EMAIL=info@praxiskerim.de
PRACTICE_WHATSAPP=+49 69 870015360
ORDER_DEADLINE=14:00
```

## For Port 3000 Appointment Form Project

For your second project (appointment booking form), you'll need:

```env
PORT=3000
API_URL=http://localhost:3030
```

The appointment form will be a **public-facing form** that:

- Allows users to book appointments
- Sends data to the main API (port 3030)
- No authentication required (public booking)
- Will need doctor selection and available slots
