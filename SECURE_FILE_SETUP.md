# Secure File Transfer Setup

## 1. Install Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner zod date-fns
```

## 2. Environment Variables

Add to your `.env` file:

```env
# AWS S3 Configuration for Secure File Transfer
AWS_REGION=eu-north-1
AWS_S3_BUCKET=telemedker-storage
AWS_KMS_KEY_ID=arn:aws:kms:eu-north-1:YOUR-ACCOUNT:key/YOUR-KMS-KEY-ID

# File Transfer Settings
FILE_TRANSFER_BIGFILES=true
FILE_TRANSFER_MAX_BIG_MB=100
FILE_TRANSFER_PRESIGN_EXPIRY_SECONDS=600
FILE_TRANSFER_WINDOW_BEFORE_MIN=15
FILE_TRANSFER_WINDOW_AFTER_MIN=60

# Security Settings
TRUSTED_UPLOAD_ORIGINS=http://localhost:3000,http://localhost:3001,https://patient.telemedker.com,https://doctor.telemedker.com
ALLOWED_FILE_CT=application/pdf,image/jpeg,image/png,image/webp,text/plain
```

## 3. Wire Routes in Express App

In your main app file (e.g., `server.js` or `app.js`):

```javascript
const fileTransferRoutes = require("./src/routes/fileTransfer");

// Ensure auth middleware is applied before file transfer routes
app.use(fileTransferRoutes);
```

## 4. AWS S3 Bucket Configuration

### CORS Configuration

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://patient.telemedker.com",
      "https://doctor.telemedker.com"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"]
  }
]
```

### Lifecycle Policy (Auto-delete after 24h)

```json
{
  "Rules": [
    {
      "ID": "ExpireTransfersAfter1Day",
      "Status": "Enabled",
      "Filter": { "Prefix": "transfers/" },
      "Expiration": { "Days": 1 }
    }
  ]
}
```

### Bucket Policy (Security)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnEncryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::telemedker-storage/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::telemedker-storage",
        "arn:aws:s3:::telemedker-storage/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

## 5. IAM Role Permissions

Create an IAM role for your server with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::telemedker-storage/transfers/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:eu-north-1:YOUR-ACCOUNT:key/YOUR-KMS-KEY-ID"
    }
  ]
}
```

## 6. KMS Key Policy

Allow S3 and your server role to use the KMS key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR-ACCOUNT:role/telemedker-server-role"
      },
      "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "s3.amazonaws.com"
      },
      "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "*"
    }
  ]
}
```

## 7. Testing Endpoints

- `GET /api/files/health` - Check if big files are enabled
- `POST /api/files/presign/upload` - Get upload URL
- `GET /api/files/presign/download` - Get download URL
- `DELETE /api/files` - Delete file early

## Security Features

✅ **GDPR Compliance**: Opaque keys, 24h auto-delete, minimal audit trail
✅ **HIPAA-Friendly**: KMS encryption, access controls, audit logging
✅ **Access Control**: Only appointment participants, time-windowed access
✅ **Rate Limiting**: 30 requests per 5 minutes per user
✅ **Integrity**: SHA-256 verification, Content-MD5 headers
✅ **Transport Security**: TLS required, presigned URLs expire in 10 minutes



