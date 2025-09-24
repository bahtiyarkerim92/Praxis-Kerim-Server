/**
 * Security Configuration for File Transfer System
 * Implements BG/DE compliance requirements
 *
 * Features:
 * - CORS configuration for explicit origins
 * - Request size limits
 * - Rate limiting
 * - Security headers (Helmet)
 * - Body logging prevention
 * - Error handling sanitization
 */

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const express = require("express");

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || "development";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:5173";
const PATIENT_URL = process.env.PATIENT_URL || "http://localhost:5174";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  DASHBOARD_URL,
  PATIENT_URL,
  // Add development URLs if not in production
  ...(NODE_ENV !== "production"
    ? [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174", // Patient app dev server
        "http://localhost:8080",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174", // Patient app dev server
        "http://127.0.0.1:8080",
      ]
    : []),
].filter(Boolean);

/**
 * CORS configuration with explicit origins
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Daily-Signature",
  ],
  maxAge: 86400, // 24 hours
};

/**
 * Rate limiting configuration
 */
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for webhooks (they have signature verification)
    skip: (req) => req.path.startsWith("/api/webhooks/"),
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
      });
    },
  });
};

// Different rate limits for different endpoints
const rateLimits = {
  // General API rate limit (disabled in development)
  general:
    NODE_ENV === "production"
      ? createRateLimit(
          15 * 60 * 1000, // 15 minutes
          1000, // Max 1000 requests per window
          "Too many API requests"
        )
      : createRateLimit(
          1 * 60 * 1000, // 1 minute in dev
          10000, // Very high limit in dev
          "Too many API requests"
        ),

  // File transfer operations (more lenient in development)
  fileTransfer:
    NODE_ENV === "production"
      ? createRateLimit(
          5 * 60 * 1000, // 5 minutes
          50, // Max 50 file operations per window
          "Too many file transfer requests"
        )
      : createRateLimit(
          1 * 60 * 1000, // 1 minute in dev
          1000, // High limit in dev
          "Too many file transfer requests"
        ),

  // Audit logging (less restrictive, best effort)
  audit: createRateLimit(
    1 * 60 * 1000, // 1 minute
    NODE_ENV === "production" ? 200 : 2000, // Higher limit in dev
    "Too many audit requests"
  ),

  // Authentication endpoints (very lenient in development)
  auth:
    NODE_ENV === "production"
      ? createRateLimit(
          15 * 60 * 1000, // 15 minutes
          50, // Max 50 login attempts per window
          "Too many authentication attempts"
        )
      : createRateLimit(
          1 * 60 * 1000, // 1 minute in dev
          1000, // Very high limit in dev
          "Too many authentication attempts"
        ),
};

/**
 * Helmet security configuration
 */
const helmetOptions = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disable for Daily.co iframe compatibility

  // Referrer Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
};

/**
 * Request size limits
 */
const sizeLimits = {
  // JSON payloads (small - no file content)
  json: "10kb",

  // URL encoded data
  urlencoded: "10kb",

  // Raw data (for webhook signatures)
  raw: "50kb",
};

/**
 * Middleware to prevent logging of sensitive request bodies
 */
const preventBodyLogging = (req, res, next) => {
  // Mark requests that should not have their body logged
  const sensitiveRoutes = [
    "/api/fallback/",
    "/api/audit/",
    "/api/webhooks/",
    "/auth/",
    "/api/doctor-auth/",
  ];

  if (sensitiveRoutes.some((route) => req.path.startsWith(route))) {
    req.skipBodyLogging = true;
  }

  next();
};

/**
 * Error sanitization middleware
 */
const sanitizeErrors = (err, req, res, next) => {
  // Don't leak sensitive information in error messages
  const sanitizedMessage =
    NODE_ENV === "production" ? "Internal server error" : err.message;

  // Log full error for debugging (but not to client)
  console.error("Server error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.status(err.status || 500).json({
    success: false,
    message: sanitizedMessage,
    ...(NODE_ENV !== "production" && { stack: err.stack }),
  });
};

/**
 * Security middleware setup function
 */
const setupSecurity = (app) => {
  // Trust proxy (for rate limiting behind load balancer)
  app.set("trust proxy", 1);

  // Helmet security headers
  app.use(helmet(helmetOptions));

  // CORS configuration
  app.use(cors(corsOptions));

  // Prevent body logging for sensitive routes
  app.use(preventBodyLogging);

  // General rate limiting
  app.use("/api/", rateLimits.general);

  // Specific rate limits
  app.use("/api/fallback/", rateLimits.fileTransfer);
  app.use("/api/audit/", rateLimits.audit);
  app.use("/auth/", rateLimits.auth);
  app.use("/api/doctor-auth/", rateLimits.auth);

  // Request size limits
  app.use(express.json({ limit: sizeLimits.json }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: sizeLimits.urlencoded,
    })
  );

  console.log("Security middleware configured");
  console.log(`Allowed CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
};

/**
 * Validation helpers
 */
const validation = {
  // Sanitize meeting ID
  sanitizeMeetingId: (meetingId) => {
    if (typeof meetingId !== "string") return null;
    return meetingId.replace(/[^a-zA-Z0-9\-_]/g, "").substring(0, 255);
  },

  // Validate file size
  isValidFileSize: (size) => {
    return Number.isInteger(size) && size > 0 && size <= 104857600; // 100MB
  },

  // Validate user ID format
  isValidUserId: (userId) => {
    if (typeof userId !== "string") return false;
    return userId.length >= 1 && userId.length <= 255;
  },

  // Sanitize filename (remove sensitive information)
  sanitizeFilename: (filename) => {
    if (typeof filename !== "string") return "document";

    // Remove path separators and dangerous characters
    let sanitized = filename.replace(/[\/\\:*?"<>|]/g, "_");

    // Limit length
    if (sanitized.length > 255) {
      const lastDot = sanitized.lastIndexOf(".");
      const extension = lastDot > 0 ? sanitized.substring(lastDot) : "";
      sanitized = sanitized.substring(0, 250 - extension.length) + extension;
    }

    return sanitized || "document";
  },
};

module.exports = {
  setupSecurity,
  corsOptions,
  rateLimits,
  helmetOptions,
  sizeLimits,
  sanitizeErrors,
  validation,
  ALLOWED_ORIGINS,
};
