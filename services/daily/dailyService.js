const crypto = require("crypto");

class DailyService {
  constructor() {
    this.apiKey = process.env.DAILY_API_KEY;
    this.domain = process.env.DAILY_DOMAIN || "telemedker.daily.co";

    if (!this.apiKey) {
      console.warn("DAILY_API_KEY not found in environment variables");
    }
  }

  /**
   * Create a Daily.co room for a consultation appointment
   * @param {Object} appointment - The appointment object
   * @returns {Promise<Object>} Room details with name and URL
   */
  async createRoom(appointment) {
    if (!this.apiKey) {
      throw new Error("Daily.co API key not configured");
    }

    const roomName = `telemedker-consult-${crypto.randomUUID()}`;

    try {
      const response = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName,
          privacy: "public", // Changed from 'open' to 'public' as per Daily.co API
          properties: {
            // Room will expire 3 hours after appointment time, or 24 hours from now if appointment is in the past
            exp: Math.floor(
              Math.max(
                new Date(appointment.date).getTime() + 3 * 60 * 60 * 1000, // 3 hours after appointment
                Date.now() + 24 * 60 * 60 * 1000 // 24 hours from now
              ) / 1000
            ),
            enable_screenshare: true,
            enable_chat: true,
            start_video_off: false,
            start_audio_off: false,
            max_participants: 10,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Daily.co API error: ${response.status} - ${errorData}`
        );
      }

      const roomData = await response.json();

      return {
        roomName: roomData.name,
        url: roomData.url,
      };
    } catch (error) {
      console.error("Error creating Daily.co room:", error);
      throw error;
    }
  }

  /**
   * Delete a Daily.co room
   * @param {string} roomName - The room name to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteRoom(roomName) {
    if (!this.apiKey || !roomName) {
      return false;
    }

    try {
      const response = await fetch(
        `https://api.daily.co/v1/rooms/${roomName}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Error deleting Daily.co room:", error);
      return false;
    }
  }
}

module.exports = new DailyService();
