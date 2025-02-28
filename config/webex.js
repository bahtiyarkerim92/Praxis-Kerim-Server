require("dotenv").config();

module.exports = {
  clientId: process.env.WEBEX_CLIENT_ID,
  clientSecret: process.env.WEBEX_CLIENT_SECRET,
  redirectUri: process.env.WEBEX_REDIRECT_URI,
  authUrl: "https://webexapis.com/v1/authorize",
  tokenUrl: "https://webexapis.com/v1/access_token",
  apiBaseUrl: "https://webexapis.com/v1",
};
