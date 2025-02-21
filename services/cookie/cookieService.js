const isProduction = process.env.NODE_ENV === "production";
const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

const cookieOptions = {
  production: {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    // !!!!!!!!!!!!!!!!!!!!! sameSite: "strict", TODO add this for realy production !!!!
    domain: ".pickup2.com",
    path: "/",
  },
  development: {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  },
};

const getOptions = () =>
  isProduction ? cookieOptions.production : cookieOptions.development;

function setRefreshTokenCookie(res, refreshToken) {
  const options = getOptions();

  res.cookie("refreshToken", refreshToken, {
    ...options,
    maxAge: oneWeek,
  });
}

function clearRefreshTokenCookie(res) {
  const options = getOptions();
  res.clearCookie("refreshToken", options);
}

module.exports = {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
