require("dotenv").config();

module.exports = () => (req, res, next) => {
  if (req.originalUrl === "/payment/webhook") {
    return next();
  }

  const isDev = process.env.NODE_ENV === "development";

  // Development origins
  const devOrigins = [
    "http://localhost:3000",
    "http://localhost:5173", // Patient app
    "http://localhost:5174", // Vue dashboard
    "http://localhost:8000",
    "http://localhost:8888",
    "capacitor://localhost",
  ];
  // Development trusted domains
  const devTrustedDomains = ["localhost"];

  // Production origins
  const prodOrigins = [
    "https://telemediker.com",
    "https://www.telemediker.com",
    "https://patient.telemediker.com", // Patient app subdomain
    "https://api.telemediker.com",
    "https://telemediker-dashboard.netlify.app",
  ];

  // Production trusted domains
  const prodTrustedDomains = [
    "telemediker.com",
    "www.telemediker.com",
    "patient.telemediker.com", // Patient app subdomain
    "api.telemediker.com",
  ];

  const allowedHeaders = [
    "Content-Type",
    "Authorization",
    "Accept",
    "Accept-Language",
    "Cookie",
    "X-Forwarded-Proto",
    "X-Forwarded-Host",
    "Referer",
    "Origin",
    "Host",
    "CF-Connecting-IP",
    "CF-IPCountry",
    "CF-Ray",
    "CF-Visitor",
    "CDN-Loop",
  ].join(", ");

  // Use different whitelists based on environment
  const corsWhitelist = isDev ? [...devOrigins, ...prodOrigins] : prodOrigins;

  // Combine trusted domains based on environment
  const trustedDomains = isDev
    ? [...devTrustedDomains, ...prodTrustedDomains]
    : prodTrustedDomains;

  // Get origin from various possible sources
  const origin =
    req.headers.origin ||
    (req.headers["cf-visitor"]
      ? JSON.parse(req.headers["cf-visitor"]).scheme +
        "://" +
        (req.headers.host || req.headers["x-forwarded-host"])
      : null);

  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host;
  const method = req.method;

  // Helper function to set CORS headers
  const setCorsHeaders = (allowedOrigin) => {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
    res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
    res.setHeader("Vary", "Origin, Cookie");
  };

  // Handle server-side rendering (no origin header)
  if (!origin) {
    const isTrustedServer = trustedDomains.some((domain) =>
      forwardedHost?.includes(domain)
    );

    if (isDev || isTrustedServer) {
      const protocol = isDev ? "http" : "https";
      const ssrOrigin = `${protocol}://${forwardedHost}`;

      setCorsHeaders(ssrOrigin);
      return next();
    }
  }

  // Special handling for development localhost requests
  if (isDev && origin?.includes("localhost")) {
    setCorsHeaders(origin);

    if (method === "OPTIONS") {
      res.setHeader("Access-Control-Max-Age", "86400");
      return res.status(204).end();
    }
    return next();
  }

  // Special handling for Cloudflare requests
  if (req.headers["cf-ray"] && origin) {
    // Check if the origin is in our whitelist or a subdomain of our trusted domains
    const isWhitelistedOrTrusted =
      corsWhitelist.includes(origin) ||
      trustedDomains.some(
        (domain) =>
          origin.includes(domain) ||
          new URL(origin).hostname.endsWith("." + domain)
      );

    if (isWhitelistedOrTrusted) {
      setCorsHeaders(origin);

      if (method === "OPTIONS") {
        res.setHeader("Access-Control-Max-Age", "86400");
        return res.status(204).end();
      }
      return next();
    }
  }

  const isWhitelisted = corsWhitelist.includes(origin);

  // Check for www/non-www variations if not directly whitelisted
  if (!isWhitelisted && origin) {
    const normalizedOrigin = origin.replace(/^(https?:\/\/)www\./, "$1");
    const normalizedWhitelist = corsWhitelist.map((url) =>
      url.replace(/^(https?:\/\/)www\./, "$1")
    );

    if (normalizedWhitelist.includes(normalizedOrigin)) {
      setCorsHeaders(origin);

      if (method === "OPTIONS") {
        res.setHeader("Access-Control-Max-Age", "86400");
        return res.status(204).end();
      }
      return next();
    }
  }

  if (isWhitelisted) {
    setCorsHeaders(origin);

    if (method === "OPTIONS") {
      res.setHeader("Access-Control-Max-Age", "86400");
      return res.status(204).end();
    }
    return next();
  }

  return res.status(403).json({
    message: "CORS policy does not allow this origin",
    allowedOrigins: corsWhitelist,
    receivedOrigin: origin,
    cfVisitor: req.headers["cf-visitor"],
    cfRay: req.headers["cf-ray"],
  });
};
