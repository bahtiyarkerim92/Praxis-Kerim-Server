# Sick Note Upload Service

A secure, organized service for uploading and managing sick note PDFs in AWS S3.

## Features

- ✅ **Organized Storage**: Files stored in `patients/{patientId}/sick-notes/{filename}` structure
- ✅ **Security**: Private files with server-side encryption (AES256)
- ✅ **Unique Filenames**: UUID + timestamp to prevent collisions
- ✅ **Presigned URLs**: Secure, temporary access to files
- ✅ **Validation**: File type, size, and input validation
- ✅ **Error Handling**: Comprehensive error responses
- ✅ **Metadata**: Rich file metadata for tracking

## Installation

```bash
npm install uuid @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Environment Variables

Create a `.env` file with your AWS configuration:

```env
AWS_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Usage

### Upload a Sick Note

```javascript
const { uploadSickNote } = require("./services/aws/sickNoteUpload");

// Example with Express/Multer
app.post("/upload", upload.single("pdf"), async (req, res) => {
  const patientId = req.body.patientId;
  const file = req.file; // Multer file object

  const result = await uploadSickNote(patientId, file);

  if (result.success) {
    console.log("Upload successful:", result.data);
    res.json(result);
  } else {
    console.error("Upload failed:", result.error);
    res.status(400).json(result);
  }
});
```

### Generate Presigned URL for Viewing

```javascript
const { generatePresignedUrl } = require("./services/aws/sickNoteUpload");

// Generate a secure URL valid for 1 hour
const presignedUrl = await generatePresignedUrl(s3Key, 3600);
```

### Delete a Sick Note

```javascript
const { deleteSickNote } = require("./services/aws/sickNoteUpload");

const result = await deleteSickNote(s3Key);
```

## File Structure in S3

```
your-bucket/
└── patients/
    └── {patientId}/
        └── sick-notes/
            ├── 1640995200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
            ├── 1640995260000_b2c3d4e5-f6g7-8901-bcde-f23456789012.pdf
            └── ...
```

## Response Format

### Success Response

```javascript
{
  success: true,
  data: {
    fileUrl: "https://bucket.s3.region.amazonaws.com/patients/123/sick-notes/filename.pdf",
    key: "patients/123/sick-notes/filename.pdf",
    bucket: "your-bucket",
    filename: "1640995200000_uuid.pdf",
    originalFilename: "sick-note.pdf",
    fileSize: 1024000,
    patientId: "123",
    contentType: "application/pdf",
    etag: "\"abc123def456\"",
    uploadTimestamp: 1640995200000
  },
  message: "Sick note uploaded successfully"
}
```

### Error Response

```javascript
{
  success: false,
  error: {
    message: "Only PDF files are allowed for sick notes",
    code: "INVALID_FILE_TYPE",
    details: "ValidationError"
  }
}
```

## Security Features

1. **Private ACL**: Files are not publicly accessible
2. **Server-Side Encryption**: Files encrypted at rest with AES256
3. **Presigned URLs**: Temporary, secure access with expiration
4. **Input Validation**: File type, size, and parameter validation
5. **Organized Access**: Files grouped by patient for access control

## File Validation

- **Type**: Only PDF files (`application/pdf`)
- **Size**: Maximum 10MB
- **Required**: File buffer and patient ID

## Error Codes

- `UPLOAD_ERROR`: General upload failure
- `INVALID_FILE_TYPE`: Non-PDF file uploaded
- `FILE_TOO_LARGE`: File exceeds 10MB limit
- `MISSING_PATIENT_ID`: Patient ID not provided
- `MISSING_FILE`: No file buffer provided

## Integration Example

```javascript
// Controller example
const { uploadSickNote } = require("../services/aws/sickNoteUpload");

router.post(
  "/sick-notes/upload",
  authenticateDoctor,
  upload.single("pdf"),
  async (req, res) => {
    try {
      const { patientId, title, diagnosis } = req.body;

      // Upload to S3
      const uploadResult = await uploadSickNote(patientId, req.file);

      if (!uploadResult.success) {
        return res.status(400).json(uploadResult);
      }

      // Save to database
      const sickNote = new SickNote({
        patientId,
        doctorId: req.doctor._id,
        title,
        diagnosis,
        pdfUrl: uploadResult.data.fileUrl,
        pdfKey: uploadResult.data.key,
        originalFileName: uploadResult.data.originalFilename,
        fileSize: uploadResult.data.fileSize,
      });

      await sickNote.save();

      res.json({
        success: true,
        sickNote,
        uploadData: uploadResult.data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);
```
