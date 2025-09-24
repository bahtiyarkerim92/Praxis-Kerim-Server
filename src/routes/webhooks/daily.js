/**
 * Daily.co Webhooks for File Transfer Cleanup
 * Handles meeting lifecycle events to cleanup encrypted files
 * Compliant with BG/DE privacy regulations
 *
 * Features:
 * - Automatic cleanup on meeting end
 * - Webhook signature verification
 * - Secure S3 object deletion
 * - Audit logging
 * - Error handling and retries
 */

const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const storage = require("../../lib/storage");
const FileTransferAudit = require("../../../models/FileTransferAudit");

const router = express.Router();

// Daily webhook secret for signature verification
const DAILY_WEBHOOK_SECRET = process.env.DAILY_WEBHOOK_SECRET;

/**
 * Verify Daily webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Daily-Signature header
 * @returns {boolean} Signature is valid
 */
function verifyWebhookSignature(payload, signature) {
  if (!DAILY_WEBHOOK_SECRET || !signature) {
    console.warn(
      "Daily webhook signature verification skipped - no secret configured"
    );
    return true; // Allow in development
  }

  try {
    // Daily uses HMAC-SHA256
    const expectedSignature = crypto
      .createHmac("sha256", DAILY_WEBHOOK_SECRET)
      .update(payload, "utf8")
      .digest("hex");

    const providedSignature = signature.replace("sha256=", "");

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedSignature, "hex")
    );
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    return false;
  }
}

/**
 * Extract meeting ID from Daily room URL or name
 * @param {object} event - Daily webhook event
 * @returns {string|null} Meeting ID
 */
function extractMeetingId(event) {
  try {
    // Try to get meeting ID from room name or URL
    const roomName = event.room?.name;
    const roomUrl = event.room?.url;

    if (roomName) {
      // If room name follows our format, use it directly
      return roomName;
    }

    if (roomUrl) {
      // Extract from URL: https://domain.daily.co/meetingId
      const match = roomUrl.match(/\/([a-zA-Z0-9\-_]+)$/);
      if (match) {
        return match[1];
      }
    }

    // Fallback: use room ID if available
    return event.room?.id || null;
  } catch (error) {
    console.error("Error extracting meeting ID:", error);
    return null;
  }
}

/**
 * Handle meeting ended event
 * @param {object} event - Daily webhook event
 */
async function handleMeetingEnded(event) {
  try {
    const meetingId = extractMeetingId(event);

    if (!meetingId) {
      console.warn("No meeting ID found in meeting.ended event");
      return;
    }

    console.log(`Processing meeting.ended event for meeting: ${meetingId}`);

    // Delete all encrypted files for this meeting
    const deletedCount = await storage.deleteByMeetingId(meetingId);

    // Log the cleanup
    console.log(
      `Cleaned up ${deletedCount} encrypted files for meeting ${meetingId}`
    );

    // Optionally log audit event for cleanup
    if (deletedCount > 0) {
      await FileTransferAudit.logTransfer({
        meetingId,
        senderId: "system",
        receiverId: "system",
        fileName: `${deletedCount}-files-cleaned`,
        fileSize: 0,
        status: "sent", // Use 'sent' to indicate cleanup completed
        method: "fallback",
      });
    }

    return { meetingId, deletedCount };
  } catch (error) {
    console.error("Error handling meeting.ended event:", error);
    throw error;
  }
}

/**
 * Handle room deleted event
 * @param {object} event - Daily webhook event
 */
async function handleRoomDeleted(event) {
  try {
    const meetingId = extractMeetingId(event);

    if (!meetingId) {
      console.warn("No meeting ID found in room.deleted event");
      return;
    }

    console.log(`Processing room.deleted event for meeting: ${meetingId}`);

    // Delete all encrypted files for this meeting (if any remain)
    const deletedCount = await storage.deleteByMeetingId(meetingId);

    console.log(
      `Cleaned up ${deletedCount} remaining encrypted files for deleted room ${meetingId}`
    );

    return { meetingId, deletedCount };
  } catch (error) {
    console.error("Error handling room.deleted event:", error);
    throw error;
  }
}

/**
 * POST /api/webhooks/daily
 * Handle Daily.co webhook events
 */
router.post(
  "/",
  // Use raw body parser for signature verification
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-daily-signature"];
      const payload = req.body;

      // Verify webhook signature
      if (!verifyWebhookSignature(payload, signature)) {
        console.warn("Invalid Daily webhook signature");
        return res.status(401).json({
          success: false,
          message: "Invalid signature",
        });
      }

      // Parse JSON payload
      let event;
      try {
        event = JSON.parse(payload);
      } catch (parseError) {
        console.error("Failed to parse webhook payload:", parseError);
        return res.status(400).json({
          success: false,
          message: "Invalid JSON payload",
        });
      }

      const eventType = event.type;

      console.log(`Received Daily webhook: ${eventType}`);

      let result = null;

      // Handle different event types
      switch (eventType) {
        case "meeting.ended":
          result = await handleMeetingEnded(event);
          break;

        case "room.deleted":
          result = await handleRoomDeleted(event);
          break;

        default:
          console.log(`Ignoring webhook event type: ${eventType}`);
          break;
      }

      // Respond to Daily
      res.json({
        success: true,
        eventType,
        processed: !!result,
        result: result || "Event ignored",
      });
    } catch (error) {
      console.error("Daily webhook processing error:", error);

      // Return 200 to prevent webhook retries for our errors
      res.json({
        success: false,
        message: "Processing failed",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/webhooks/daily/health
 * Health check for webhook endpoint
 */
router.get("/health", async (req, res) => {
  try {
    // Test S3 connection
    const storageHealthy = await storage.validateConfig();

    res.json({
      success: true,
      healthy: storageHealthy,
      webhookSecretConfigured: !!DAILY_WEBHOOK_SECRET,
      supportedEvents: ["meeting.ended", "room.deleted"],
    });
  } catch (error) {
    console.error("Webhook health check error:", error);

    res.json({
      success: false,
      healthy: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhooks/daily/test-cleanup
 * Manual test endpoint for cleanup (development only)
 */
router.post("/test-cleanup", express.json(), async (req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({
      success: false,
      message: "Not found",
    });
  }

  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: "Meeting ID required",
      });
    }

    // Simulate meeting.ended event
    const result = await handleMeetingEnded({
      type: "meeting.ended",
      room: {
        name: meetingId,
        id: meetingId,
      },
    });

    res.json({
      success: true,
      message: "Test cleanup completed",
      result,
    });
  } catch (error) {
    console.error("Test cleanup error:", error);

    res.status(500).json({
      success: false,
      message: "Test cleanup failed",
      error: error.message,
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error("Daily webhook error:", error);

  // Always return 200 to prevent webhook retries
  res.json({
    success: false,
    message: "Webhook processing failed",
    error: error.message,
  });
});

module.exports = router;
