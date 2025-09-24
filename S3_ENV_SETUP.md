# S3 Secure File Transfer - Environment Setup

## ✅ COMPLETED STEPS

- ✅ S3 routes wired into Express app
- ✅ Authentication middleware added
- ✅ Dependencies installed (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `zod`, `date-fns`)

## 🔧 REQUIRED: Add to .env File

Add these environment variables to your `.env` file in the server root:

```env
# AWS Configuration for S3 File Transfer
AWS_REGION=eu-north-1
AWS_S3_BUCKET=telemedker-storage
AWS_KMS_KEY_ID=your-kms-key-id-here

# File Transfer Settings
FILE_TRANSFER_BIGFILES=true
FILE_TRANSFER_MAX_BIG_MB=100
FILE_TRANSFER_PRESIGN_EXPIRY_SECONDS=600
FILE_TRANSFER_WINDOW_BEFORE_MIN=15
FILE_TRANSFER_WINDOW_AFTER_MIN=60

# Trusted Origins (update with your domains)
TRUSTED_UPLOAD_ORIGINS=http://localhost:3000,http://localhost:3001,https://patient.telemedker.com,https://doctor.telemedker.com

# Allowed Content Types
ALLOWED_FILE_CT=application/pdf,image/jpeg,image/png,image/webp,text/plain
```

## 🚀 QUICK TEST (Without AWS Setup)

**To test that the system is working, just add this ONE line to your .env:**

```env
FILE_TRANSFER_BIGFILES=true
```

**Then restart your server:**

```bash
npm start
# or
node index.js
```

**Expected Result:**

- ✅ Patient UI will show: "All files (≤100MB): Secure S3 transfer (downloadable by late joiners)"
- ✅ Doctor UI will show: "All files (≤100MB): Secure S3 transfer (downloadable by late joiners)"
- ⚠️ File uploads will fail with S3 errors (expected without AWS setup)

## 🔐 FULL AWS SETUP (For Production)

1. **Create S3 Bucket**: `telemedker-storage`
2. **Create KMS Key**: Replace `your-kms-key-id-here` with actual key ID
3. **Set IAM Permissions**: Server needs S3 and KMS access
4. **Configure Bucket**: CORS, Lifecycle (24h deletion), Security policies

See `AWS_INFRASTRUCTURE_SETUP.md` for detailed AWS configuration.

## 🧪 TESTING STEPS

1. **Add `FILE_TRANSFER_BIGFILES=true` to .env**
2. **Restart server**
3. **Upload a file (any size) in patient app**
4. **Join late with doctor**
5. **Click 🔄 Request button**
6. **File should be downloadable!**

## 🎯 THE FIX

Your 27KB PDF will now use **S3 instead of WebRTC**, making it downloadable by late joiners!



