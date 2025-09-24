// @ts-check
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Using your existing S3 variable names with fallbacks
const s3 = new S3Client({
  region: process.env.AWS_S3_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || "",
  },
});

/**
 * @param {{key:string, contentType:string, contentMd5:string, expiresSeconds:number}} p
 */
async function presignPut(p) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKETNAME,
    Key: p.key,
    ContentType: p.contentType,
    ContentMD5: p.contentMd5,
    ServerSideEncryption: "AES256", // Simplified encryption (no KMS key needed)
  });
  return getSignedUrl(s3, cmd, { expiresIn: p.expiresSeconds });
}

/**
 * @param {{key:string, downloadName:string, expiresSeconds:number}} p
 */
async function presignGet(p) {
  const cmd = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKETNAME,
    Key: p.key,
    ResponseContentDisposition: `attachment; filename="${p.downloadName}"`,
  });
  return getSignedUrl(s3, cmd, { expiresIn: p.expiresSeconds });
}

/** @param {{key:string}} p */
function deleteObject(p) {
  const cmd = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKETNAME,
    Key: p.key,
  });
  return s3.send(cmd);
}

module.exports = { s3, presignPut, presignGet, deleteObject };
