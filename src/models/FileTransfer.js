// @ts-check
const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Types.ObjectId,
      index: true,
      required: true,
    },
    senderId: { type: mongoose.Types.ObjectId, required: true },
    recipientIds: [{ type: mongoose.Types.ObjectId }],
    key: { type: String, required: true, index: true }, // opaque
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
    deletedAt: { type: Date, index: true },
  },
  {
    versionKey: false,
    // Auto-delete audit records after 30 days for GDPR compliance
    expires: 30 * 24 * 60 * 60, // 30 days in seconds
  }
);

// Index for efficient cleanup queries
schema.index({ createdAt: 1 });
schema.index({ appointmentId: 1, key: 1 });

module.exports = mongoose.model("FileTransfer", schema);



