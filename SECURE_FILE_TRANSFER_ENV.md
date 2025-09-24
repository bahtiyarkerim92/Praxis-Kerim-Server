# Secure File Transfer Environment Configuration

This document outlines the environment variables required for the BG/DE compliant secure file transfer system.

## Required Environment Variables

Add these to your `.env` file in the `telemedker-server` directory:

### S3 Storage Configuration (EU Region)

```env
# AWS S3 Configuration for EU compliance
STORAGE_REGION=eu-north-1
STORAGE_BUCKET=telemedker-temp-files
STORAGE_TTL_MIN=10

# AWS Credentials (use IAM roles in production)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=eu-north-1
```

### File Transfer Limits

```env
# Maximum file size in bytes (100MB default)
FILE_MAX_BYTES=104857600

# Daily.co webhook secret for signature verification
DAILY_WEBHOOK_SECRET=your_daily_webhook_secret_here
```

### Security Configuration

```env
# CORS Origins (production URLs)
CLIENT_URL=https://your-client-domain.com
DASHBOARD_URL=https://your-dashboard-domain.com
PATIENT_URL=https://your-patient-app-domain.com

# Node environment
NODE_ENV=production
```

### Database Configuration (Existing)

```env
# MongoDB connection (should already be configured)
DB_CONNECTION_STRING=mongodb://localhost:27017/telemedker
```

## S3 Bucket Setup

### 1. Create S3 Bucket

```bash
aws s3 mb s3://telemedker-temp-files --region eu-north-1
```

### 2. Configure Bucket Policy

Create a bucket policy that restricts access to your application:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TelemedkerAppAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/TelemedkerRole"
      },
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::telemedker-temp-files/*"
    }
  ]
}
```

### 3. Configure Lifecycle Rules

Set up automatic deletion of objects after 24 hours:

```json
{
  "Rules": [
    {
      "ID": "DeleteTempFiles",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "meetings/"
      },
      "Expiration": {
        "Days": 1
      }
    }
  ]
}
```

### 4. Enable Encryption

Enable server-side encryption:

```bash
aws s3api put-bucket-encryption \
  --bucket telemedker-temp-files \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }'
```

## Daily.co Webhook Setup

### 1. Configure Webhook Endpoint

In your Daily.co dashboard, add webhook endpoint:

```
URL: https://your-server-domain.com/api/webhooks/daily
Events: meeting.ended, room.deleted
Secret: your_daily_webhook_secret_here
```

### 2. Test Webhook

Test the webhook endpoint:

```bash
curl -X GET https://your-server-domain.com/api/webhooks/daily/health
```

Expected response:

```json
{
  "success": true,
  "healthy": true,
  "webhookSecretConfigured": true,
  "supportedEvents": ["meeting.ended", "room.deleted"]
}
```

## Security Considerations

### 1. IAM Role (Recommended for Production)

Instead of access keys, use IAM roles:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::telemedker-temp-files",
        "arn:aws:s3:::telemedker-temp-files/*"
      ]
    }
  ]
}
```

### 2. Network Security

- Use HTTPS only
- Configure VPC endpoints for S3 access
- Restrict S3 bucket access to your application's IP ranges

### 3. Monitoring

Enable CloudTrail and S3 access logging:

```bash
aws s3api put-bucket-logging \
  --bucket telemedker-temp-files \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "telemedker-access-logs",
      "TargetPrefix": "access-logs/"
    }
  }'
```

## Testing the Setup

### 1. Test S3 Connection

```bash
curl -X GET https://your-server-domain.com/api/fallback/health
```

Expected response:

```json
{
  "success": true,
  "available": true,
  "region": "eu-north-1",
  "maxFileSize": 104857600,
  "ttlMinutes": 10
}
```

### 2. Test File Upload Flow

1. **Get Upload URL** (authenticated):

```bash
curl -X POST https://your-server-domain.com/api/fallback/presign-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meetingId": "test-meeting-123"}'
```

2. **Upload File** (to returned URL):

```bash
curl -X PUT "PRESIGNED_UPLOAD_URL" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-file.txt
```

3. **Get Download URL** (authenticated):

```bash
curl -X POST https://your-server-domain.com/api/fallback/presign-download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"objectKey": "RETURNED_OBJECT_KEY"}'
```

### 3. Test Audit Logging

```bash
curl -X POST https://your-server-domain.com/api/audit/file-transfer \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meetingId": "test-meeting-123",
    "senderId": "doctor123",
    "receiverId": "patient456",
    "fileName": "document.pdf",
    "fileSize": 1024,
    "status": "sent"
  }'
```

## Compliance Notes

### BG/DE Privacy Compliance

- ✅ Files stored in EU region (eu-north-1)
- ✅ Automatic deletion after 10 minutes
- ✅ Server-side encryption at rest
- ✅ No server access to file contents
- ✅ Minimal metadata logging only
- ✅ TTL-based automatic cleanup
- ✅ Pseudonymized user identifiers

### GDPR Compliance Features

- Data minimization: Only essential metadata stored
- Purpose limitation: Files only for meeting duration
- Storage limitation: Automatic deletion after 90 days (audit) / 10 minutes (files)
- Security: Encryption at rest and in transit
- Transparency: Clear privacy notices in UI

## Troubleshooting

### Common Issues

1. **S3 Access Denied**

   - Check AWS credentials and permissions
   - Verify bucket exists in correct region
   - Check bucket policy allows your application

2. **Webhook Not Receiving Events**

   - Verify webhook URL is accessible from internet
   - Check Daily.co webhook configuration
   - Verify webhook secret matches environment variable

3. **File Upload Fails**
   - Check file size limits
   - Verify presigned URL hasn't expired
   - Check S3 bucket permissions

### Logs to Check

- Application logs: `pm2 logs` or container logs
- S3 access logs (if enabled)
- Daily.co webhook delivery logs
- MongoDB logs for audit records

## Production Deployment

### Required Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x.x",
    "@aws-sdk/s3-request-presigner": "^3.x.x",
    "express-validator": "^6.x.x",
    "helmet": "^6.x.x",
    "express-rate-limit": "^6.x.x"
  }
}
```

### Health Check Endpoints

Monitor these endpoints:

- `GET /api/fallback/health` - S3 connectivity
- `GET /api/audit/health` - Audit system
- `GET /api/webhooks/daily/health` - Webhook system

### Monitoring Metrics

Track these metrics:

- File transfer success/failure rates
- S3 storage usage
- Webhook delivery success
- API response times
- Error rates by endpoint

## Support

For issues with this implementation:

1. Check server logs for detailed error messages
2. Verify environment variables are correctly set
3. Test S3 connectivity independently
4. Verify Daily.co webhook configuration
5. Check database connectivity for audit logging
