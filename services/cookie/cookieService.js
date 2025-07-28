require("dotenv").config();
const isProduction = process.env.NODE_ENV === "production";
const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Cookie options optimized for cross-domain usage
const cookieOptions = {
  production: {
    httpOnly: true,
    secure: true, // Must be true for cross-domain and sameSite: none
    sameSite: "none",
    maxAge: oneWeek,
    path: "/",
    domain: ".telemediker.com", // Root domain to allow sharing between subdomains
  },
  development: {
    httpOnly: false, // Allow client-side access for cross-domain auth detection
    secure: false, // Allow non-secure in development
    sameSite: "lax",
    path: "/",
    maxAge: oneWeek,
  },
};

// Get the base options based on environment
const getBaseOptions = () =>
  isProduction ? cookieOptions.production : cookieOptions.development;

function getOptions(req) {
  const options = { ...getBaseOptions() };
  return options;
}

function setRefreshTokenCookie(res, refreshToken, req) {
  const options = getOptions(req);
  res.cookie("refreshToken", refreshToken, options);
}

function clearRefreshTokenCookie(res, req) {
  const options = getOptions(req);
  const { maxAge, ...clearOptions } = options;

  res.clearCookie("refreshToken", clearOptions);
}

module.exports = {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
