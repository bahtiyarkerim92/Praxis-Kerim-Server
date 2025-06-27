const { S3Client } = require("@aws-sdk/client-s3");

// Create S3 client for AWS SDK v3
const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

// S3 bucket configuration
const bucketName = process.env.AWS_S3_BUCKETNAME;
const region = process.env.AWS_S3_REGION || "eu-north-1";

if (!bucketName) {
  console.error("AWS_S3_BUCKETNAME environment variable is required");
  process.exit(1);
}

module.exports = {
  s3Client,
  bucketName,
  region,
};
