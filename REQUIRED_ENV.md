# Required Environment Variables

## Minimal .env Configuration

Create a `.env` file in the server root with these **required** variables:

```env
# Server Configuration
PORT=3030
NODE_ENV=development

# Database - MongoDB Connection
DB_CONNECTION_STRING=mongodb://localhost:27017/telemedker

# JWT Authentication Secrets
ACCESS_TOKEN_SECRET=generate-random-32-byte-hex-here
REFRESH_TOKEN_SECRET=generate-random-32-byte-hex-here

# Admin Account (Optional - for createAdmin script)
ADMIN_EMAIL=admin@telemedker.com
ADMIN_PASSWORD=Admin123!
ADMIN_NAME=Admin
```

## Generate JWT Secrets

Run these commands to generate secure random secrets:

```bash
node -e "console.log('ACCESS_TOKEN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('REFRESH_TOKEN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

## Environment Variables Explained

### Server

- **PORT** - Server port (default: 3030)
- **NODE_ENV** - Environment mode (development/production)

### Database

- **DB_CONNECTION_STRING** - MongoDB connection URL
  - Local: `mongodb://localhost:27017/telemedker`
  - Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/telemedker`

### Authentication

- **ACCESS_TOKEN_SECRET** - Secret for access tokens (expires in 30 minutes)
- **REFRESH_TOKEN_SECRET** - Secret for refresh tokens (expires in 7 days)

### Admin Account

- **ADMIN_EMAIL** - Default admin email (optional)
- **ADMIN_PASSWORD** - Default admin password (optional)
- **ADMIN_NAME** - Default admin name (optional)

## What Was Removed ❌

You can **DELETE** these from your .env if they exist:

### Email Service (Not used)

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- `EMAIL_FROM`
- `EMAIL_TOKEN_SECRET`

### AWS S3 (Not used)

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET_NAME`
- `AWS_S3_BUCKET_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `S3_REGION`

### Daily.co Video (Not used)

- `DAILY_API_KEY`
- `DAILY_DOMAIN`

### Payments (Not used)

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Any payment gateway keys

### File Transfer (Not used)

- Any file transfer or encryption keys
- `ENCRYPTION_KEY`
- `SECURE_FILE_*` keys

### Localization (Not used)

- `DEFAULT_LANGUAGE`
- Any locale-related keys

## Quick Start

1. Create `.env` file:

```bash
cp .env.example .env
```

2. Generate secrets and update the file

3. Start MongoDB

4. Create admin account:

```bash
node scripts/createAdmin.js
```

5. Start server:

```bash
npm start
```

## For Appointment Form Project (Port 3000)

Your second project will need a separate `.env`:

```env
# Frontend Appointment Form
PORT=3000
VITE_API_URL=http://localhost:3030
```

This will be a public booking form that connects to your admin dashboard API.
