const router = require("express").Router();
const axios = require("axios");
require("dotenv").config();

const webexConfig = {
  clientId: process.env.WEBEX_CLIENT_ID,
  clientSecret: process.env.WEBEX_CLIENT_SECRET,
  redirectUri: "http://localhost:3000/dashboard/video-calls/callback",
  tokenUrl: "https://webexapis.com/v1/access_token",
  apiBaseUrl: "https://webexapis.com/v1",
};

// Step 1: Redirect User to Webex OAuth
router.get("/login", (req, res) => {
  const authUrl =
    "https://webexapis.com/v1/authorize?client_id=C3537e62068029596a06b0fb769348ce0e110a13b5ce085c228b17c9ad3be11f6&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fdashboard%2Fvideo-calls%2Fcallback&scope=meeting%3Aparticipants_read%20meeting%3Aparticipants_write%20meeting%3Arecordings_read%20meeting%3Arecordings_write%20meeting%3Aschedules_read%20meeting%3Aschedules_write%20spark%3Akms&state=set_state_here";
  res.redirect(authUrl);
});

// Step 2: Handle OAuth Callback & Get Access Token
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Authorization failed!" });
  }

  try {
    const response = await axios.post(
      "https://webexapis.com/v1/access_token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.WEBEX_CLIENT_ID,
        client_secret: process.env.WEBEX_CLIENT_SECRET,
        code,
        redirect_uri: process.env.WEBEX_REDIRECT_URI,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    // Save access token in session (or DB for persistent storage)
    req.session.webexAccessToken = response.data.access_token;

    res.redirect("http://localhost:3000/dashboard/callback"); // Redirect to frontend
    // Redirect to dashboard after successful login
  } catch (error) {
    console.error("OAuth Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to get access token" });
  }
});

router.post("/token", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is missing" });
  }

  try {
    const response = await fetch(webexConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: webexConfig.clientId,
        client_secret: webexConfig.clientSecret,
        code,
        redirect_uri: webexConfig.redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok)
      throw new Error(data.error || "Failed to exchange Webex token");

    // Store token (session or database)
    req.session.webexAccessToken = data.access_token;

    res.json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (error) {
    console.error("Error exchanging Webex token:", error.message);
    res.status(500).json({ error: "Failed to exchange Webex token" });
  }
});
router.get("/my-meetings", async (req, res) => {
  if (!req.session) {
    return res
      .status(500)
      .json({ error: "Session is not initialized. Restart the server." });
  }

  if (!req.session.webexAccessToken) {
    return res
      .status(401)
      .json({ error: "Unauthorized. Please log in again." });
  }

  try {
    const response = await fetch(`${webexConfig.apiBaseUrl}/meetings`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${req.session.webexAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to fetch Webex meetings");

    res.json(data.items);
  } catch (error) {
    console.error("Webex Meeting Fetch Error:", error.message);
    res.status(500).json({ error: "Failed to fetch Webex meetings" });
  }
});
module.exports = router;
