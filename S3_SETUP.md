# AWS S3 Configuration for Telemedker

This application uses AWS S3 for image storage. Follow these steps to set up S3 integration.

## Required Environment Variables

Add these variables to your `.env` file:

```env
# AWS S3 Configuration
AWS_S3_ACCESS_KEY_ID=your_aws_access_key_id
AWS_S3_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_REGION=eu-north-1
AWS_S3_BUCKETNAME=your-s3-bucket-name
```

## AWS S3 Setup Steps

### 1. Create an S3 Bucket

1. Log in to AWS Console
2. Navigate to S3 service
3. Click "Create bucket"
4. Choose a unique bucket name (e.g., `telemedker-images-prod`)
5. Select your preferred region
6. Configure bucket settings:
   - **Public Access**: Unblock public access for public-read ACL
   - **Versioning**: Enable if desired
   - **Encryption**: Enable server-side encryption

### 2. Configure Bucket Policy

Add this bucket policy to allow public read access to uploaded images:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 3. Create IAM User

1. Navigate to IAM service in AWS Console
2. Create a new user for the application
3. Attach this custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::your-bucket-name"
    }
  ]
}
```

4. Generate access keys for this user
5. Add the access keys to your environment variables

### 4. CORS Configuration

Configure CORS for your S3 bucket to allow web uploads:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

## Testing the Setup

1. Start the server with the environment variables configured
2. Log in to the dashboard
3. Try uploading a profile image
4. Check that the image appears in your S3 bucket
5. Verify the image URL is accessible publicly

## Image Storage Structure

Images are stored in the following structure:

```
your-bucket-name/
└── doctors/
    └── profile-images/
        ├── 1703123456789_abc123.jpg
        ├── 1703123456790_def456.png
        └── ...
```

## Security Considerations

- Use IAM roles with minimal required permissions
- Enable CloudTrail for S3 API logging
- Consider using signed URLs for sensitive content
- Regularly rotate access keys
- Monitor S3 access patterns for unusual activity

## Cost Optimization

- Set up lifecycle rules to transition old images to cheaper storage classes
- Monitor storage usage and costs
- Consider using CloudFront CDN for better performance and lower egress costs
