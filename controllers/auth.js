require("dotenv").config();
const authController = require("express").Router();
const User = require("../models/User");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  sendValidationEmail,
  sendForgotPassword,
} = require("../services/mailer");
const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require("../services/cookie/cookieService");
const {
  validateRegisterRequest,
  handleValidation,
} = require("../validations/registerValidation");

const {
  validateEmailValidationRequest,
  handleEmailValidation,
} = require("../validation/emailValidation");

const {
  validateLoginRequest,
  handleLoginValidation,
} = require("../validation/loginValidation");

const {
  validateResendValidationEmailRequest,
  handleResendValidationEmail,
} = require("../validation/resentValidation");

const {
  validateResetPasswordRequest,
  handleResetPasswordRequest,
} = require("../validation/resetPasswordValidation");

const { authenticateToken } = require("../middleware/auth");

authController.post(
  "/register",
  validateRegisterRequest,
  handleValidation,
  async (req, res) => {
    const locale = req.headers["accept-language"] || "en";
    console.log("Registration request:", { locale, body: req.body });
    try {
      const {
        firstName,
        lastName,
        gender,
        birthDate,
        address,
        addressNumber,
        postCode,
        city,
        country,
        countryName,
        email,
        password,
        insurance,
        nationalIdNumber,
        isExistingPatient,
        ipCountry,
        termsAccepted,
      } = req.body;

      // Check for existing user
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const user = new User({
        firstName,
        lastName,
        gender,
        birthday: new Date(birthDate),
        address: {
          street: address,
          number: addressNumber,
          postCode,
          city,
          country: {
            code: country,
            name: countryName,
          },
        },
        email: email.toLowerCase(),
        password: hashedPassword,
        nationalIdNumber: country === "BG" ? nationalIdNumber : undefined,
        isExistingPatient: country === "BG" ? isExistingPatient : undefined,
        insurance: country === "DE" ? insurance : undefined,
        termsAccepted,
        ipCountry,
      });

      console.log("Creating user with data:", user);

      await user.save();
      const validationToken = generateValidationToken(user);
      await sendValidationEmail(user.email, validationToken, locale);
      res.status(201).json({
        message: "User registered successfully",
        userId: user._id,
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === 11000) {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(500).json({ message: "Error during registration" });
    }
  }
);

authController.post(
  "/login",
  validateLoginRequest,
  handleLoginValidation,
  async (req, res) => {
    const { email, password, ip } = req.body;
    console.log(ip);
    try {
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(400).json({
          message: "Email or password is incorrect",
        });
      }
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(400).json({
          message: "Email or password is incorrect",
        });
      }

      if (!user.isEmailValidated) {
        return res.status(403).json({
          message: "Please validate your email before logging in",
          isEmailValidated: false,
          email: user.email,
        });
      }
      // Invalidate previous refresh token
      user.refreshToken = null;
      await user.save({ validateBeforeSave: false });

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });

      // Set refresh token in HTTP-only cookie
      setRefreshTokenCookie(res, refreshToken);

      // Send access token in response body
      res.status(200).json({
        message: "Login successful",
        userId: user._id,
        userType: user.userType,

        accessToken,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

authController.post(
  "/validate-email",
  validateEmailValidationRequest,
  handleEmailValidation,
  async (req, res) => {
    const { token, locale } = req.query;
    if (!token) {
      return res.status(400).send("Token is required");
    }
    try {
      const decoded = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(400).send("Invalid token");
      }

      // Check if email is already validated
      if (user.isEmailValidated) {
        return res.status(200).json({
          message: "Email is already validated.",
          isEmailValidated: true,
        });
      }

      user.isEmailValidated = true;
      await user.save();

      const refreshToken = generateRefreshToken(user);

      user.refreshToken = refreshToken;
      await user.save();
      setRefreshTokenCookie(res, refreshToken);
      await sendRegistrationCompletedEmail(user.email, locale);
      res.status(200).json({ message: "Email validated successfully." });
    } catch (error) {
      // Check if the error is a JWT verification error
      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        // Try to find user with validated email
        try {
          const decoded = jwt.decode(token);
          if (decoded && decoded.userId) {
            const user = await User.findById(decoded.userId);
            if (user && user.isEmailValidated) {
              return res.status(200).json({
                message: "Email is already validated.",
                isEmailValidated: true,
              });
            }
          }
        } catch (innerError) {
          console.error("Error checking user validation status:", innerError);
        }
      }
      res.status(400).send("Invalid or expired token.");
    }
  }
);

authController.post(
  "/resend-validation-email",

  validateResendValidationEmailRequest,
  handleResendValidationEmail,
  async (req, res) => {
    const { email, locale } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.isEmailValidated) {
        return res.status(400).json({ message: "Email is already validated." });
      }

      // Check if there is a recent token that is still valid
      const tokenExpiryTime = 3600; // 1 hour in seconds
      const currentTime = Math.floor(Date.now() / 1000);
      const lastEmailSentTime = Math.floor(
        user.emailTokenIssuedAt.getTime() / 1000
      );
      const timeElapsed = currentTime - lastEmailSentTime;

      // If less than 1 minute has passed since last email
      if (timeElapsed < 60) {
        return res.status(400).json({
          message: "Please wait before requesting another email",
          retryAfter: 60 - timeElapsed,
        });
      }

      // If the current token is still valid (less than 1 hour old)
      if (timeElapsed < tokenExpiryTime) {
        return res.status(400).json({
          message: "A valid verification email was already sent.",
          retryAfter: tokenExpiryTime - timeElapsed,
        });
      }

      // Generate a new validation token and update issued time
      const validationToken = generateValidationToken(user);
      user.emailTokenIssuedAt = new Date();
      await user.save();

      await sendValidationEmail(user.email, validationToken, locale);

      res.status(200).json({ message: "Validation email resent successfully" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "An error occurred while resending the email" });
    }
  }
);

authController.post(
  "/forgot-password",
  validateResendValidationEmailRequest,
  handleResendValidationEmail,
  async (req, res) => {
    const { email, locale } = req.body;
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({
          message: "User with this email does not exist",
        });
      }

      // Check if there is a recent token that is still valid
      const tokenExpiryTime = 3600; // 1 hour in seconds
      const currentTime = Date.now();
      const lastEmailSentTime = user.resetPasswordExpires
        ? user.resetPasswordExpires.getTime()
        : 0;
      const timeElapsed = Math.floor((currentTime - lastEmailSentTime) / 1000); // Convert to seconds

      // If less than 1 minute has passed since last email
      if (timeElapsed < 60) {
        return res.status(400).json({
          message: "Please wait before requesting another reset email",
          retryAfter: 60 - timeElapsed,
        });
      }

      // If the current token is still valid (less than 1 hour old)
      if (
        timeElapsed < tokenExpiryTime &&
        lastEmailSentTime > currentTime - tokenExpiryTime * 1000
      ) {
        return res.status(400).json({
          message:
            "A valid reset email was already sent. Please check your inbox or spam folder.",
          retryAfter: tokenExpiryTime - timeElapsed,
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpires;
      await user.save();

      const resetUrl = `${process.env.FRONTEND_DOMAIN}${
        locale === "en" ? "" : `${locale}/`
      }reset-password?token=${resetToken}`;
      await sendForgotPassword(email, resetUrl, locale, user.companyName);

      res.status(200).json({
        message: "Password reset email sent successfully",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

authController.post(
  "/reset-password",
  validateResetPasswordRequest,
  handleResetPasswordRequest,
  async (req, res) => {
    const { token, newPassword } = req.body;
    try {
      const user = await User.findOne({
        resetPasswordToken: token,
      });

      if (!user) {
        return res.status(400).json({
          message: "Invalid token.",
        });
      }

      // Check if token is expired
      if (
        !user.resetPasswordExpires ||
        user.resetPasswordExpires < Date.now()
      ) {
        return res.status(401).json({
          message: "Token has expired.",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user's password and clear ALL reset-related fields
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(200).json({
        message: "Password has been reset successfully.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Internal server error.",
      });
    }
  }
);

authController.get("/status", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        isAuthenticated: false,
        message: "No refresh token provided",
      });
    }

    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      const user = await User.findOne({
        _id: decoded.userId,
        refreshToken: refreshToken,
      });

      if (!user) {
        return res.status(403).json({
          isAuthenticated: false,
          message: "Invalid refresh token",
        });
      }

      const accessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      // Update refresh token in database
      user.refreshToken = newRefreshToken;
      await user.save();

      // Set new refresh token in cookie
      setRefreshTokenCookie(res, newRefreshToken);

      return res.status(200).json({
        isAuthenticated: true,
        accessToken,
        userId: user._id,
      });
    } catch (err) {
      return res.status(403).json({
        isAuthenticated: false,
        message: "Invalid refresh token",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      isAuthenticated: false,
      message: "Internal server error",
    });
  }
});

authController.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findOne({
      _id: decoded.userId,
      refreshToken: refreshToken,
    });

    if (!user) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Update refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set new refresh token in cookie
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      accessToken,
      userId: user._id,
    });
  } catch (error) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

authController.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    // Invalidate the refresh token in the database
    if (refreshToken) {
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }

    // Clear refresh token cookie
    clearRefreshTokenCookie(res);

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

authController.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create response object based on user's country
    const profileData = {
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      gender: user.gender,
      birthday: user.birthday,
      address: `${user.address.street} ${user.address.number}, ${user.address.postCode} ${user.address.city}, ${user.address.country.name}`,
    };

    // Add country-specific data
    if (user.address.country.code === "BG") {
      profileData.nationalIdNumber = user.nationalIdNumber;
    } else if (user.address.country.code === "DE") {
      profileData.insurance = {
        type: user.insurance.type,
        company: user.insurance.company,
        number: user.insurance.number,
      };
    }

    res.status(200).json(profileData);
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ message: "Error fetching profile data" });
  }
});

function generateAccessToken(user) {
  return jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "30m",
  });
}

function generateRefreshToken(user) {
  return jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
}

function generateValidationToken(user) {
  return jwt.sign({ userId: user._id }, process.env.EMAIL_TOKEN_SECRET, {
    expiresIn: "1h",
  });
}

module.exports = authController;
