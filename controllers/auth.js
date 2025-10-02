require("dotenv").config();
const authController = require("express").Router();
const User = require("../models/User");
const Newsletter = require("../models/Newsletter");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { check } = require("express-validator");
const {
  sendValidationEmail,
  sendForgotPassword,
} = require("../services/mailer");

const {
  validateRegisterRequest,
  handleValidation,
} = require("../validations/registerValidation");

const {
  validateMinimalRegisterRequest,
  handleMinimalValidation,
} = require("../validations/minimalRegisterValidation");

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

const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require("../services/cookie/cookieService");
const {
  generateAccessToken,
  generateRefreshToken,
  generateValidationToken,
  verifyToken,
  storeRefreshToken,
  invalidateRefreshToken,
} = require("../services/token/tokenService");

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
        ipCountry,
        termsAccepted,
        privacyAccepted,
        newsletterSubscribed,
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
        insurance: country === "DE" ? insurance : undefined,
        termsAccepted,
        privacyAccepted,
        newsletterSubscribed: newsletterSubscribed || false,
        ipCountry,
        emailTokenIssuedAt: new Date(),
      });

      console.log("Creating user with data:", user);

      await user.save();

      // Create newsletter subscription if user opted in
      if (newsletterSubscribed) {
        try {
          const newsletter = new Newsletter({
            email: user.email,
            userId: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            source: "registration",
            isActive: true,
          });
          await newsletter.save();
          console.log("✅ Newsletter subscription created");
        } catch (newsletterError) {
          console.warn(
            "⚠️ Failed to create newsletter subscription:",
            newsletterError.message
          );
          // Don't fail registration if newsletter creation fails
        }
      }

      // Try to send validation email, but don't fail registration if it fails
      try {
        const validationToken = generateValidationToken(user);
        await sendValidationEmail(user.email, validationToken, locale);
        console.log("✅ Validation email sent successfully");
      } catch (emailError) {
        console.warn(
          "⚠️ Failed to send validation email, but registration continues:",
          emailError.message
        );
        // For development: automatically validate the email if sending fails
        if (process.env.NODE_ENV === "development") {
          const validationToken = generateValidationToken(user);
          const validationUrl = `${process.env.FRONTEND_DOMAIN}${locale}/validate-email?token=${validationToken}`;

          console.log("🔧 Development mode: Email auto-validated");
          console.log("📧 Validation URL (for testing):", validationUrl);

          user.isEmailValidated = true;
          await user.save();
        }
      }

      res.status(201).json({
        message: "User registered successfully",
        userId: user._id,
        emailValidationRequired: !user.isEmailValidated,
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

// Minimal registration endpoint for progressive registration
authController.post(
  "/register-minimal",
  validateMinimalRegisterRequest,
  handleMinimalValidation,
  async (req, res) => {
    const locale = req.headers["accept-language"] || "en";
    console.log("Minimal registration request:", { locale, body: req.body });
    try {
      const {
        email,
        password,
        termsAccepted,
        privacyAccepted,
        newsletterSubscribed,
      } = req.body;

      // Check for existing user
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user with minimal data
      const user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        termsAccepted,
        privacyAccepted,
        newsletterSubscribed: newsletterSubscribed || false,
        isProfileComplete: false,
        emailTokenIssuedAt: new Date(),
      });

      console.log("Creating minimal user with data:", user);

      await user.save();

      // Create newsletter subscription if user opted in
      if (newsletterSubscribed) {
        try {
          const newsletter = new Newsletter({
            email: user.email,
            userId: user._id,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            source: "registration",
            isActive: true,
          });
          await newsletter.save();
          console.log(
            "✅ Newsletter subscription created for minimal registration"
          );
        } catch (newsletterError) {
          console.warn(
            "⚠️ Failed to create newsletter subscription:",
            newsletterError.message
          );
          // Don't fail registration if newsletter creation fails
        }
      }

      // Try to send validation email, but don't fail registration if it fails
      try {
        const validationToken = generateValidationToken(user);
        await sendValidationEmail(user.email, validationToken, locale);
        console.log("✅ Validation email sent successfully");
      } catch (emailError) {
        console.warn(
          "⚠️ Failed to send validation email, but registration continues:",
          emailError.message
        );
        // For development: automatically validate the email if sending fails
        if (process.env.NODE_ENV === "development") {
          user.isEmailValidated = true;
          await user.save();
          console.log("🔧 Development mode: Email auto-validated");
        }
      }

      res.status(201).json({
        message: "User registered successfully",
        userId: user._id,
        isProfileComplete: false,
        emailValidationRequired: !user.isEmailValidated,
      });
    } catch (error) {
      console.error("Minimal registration error:", error);
      if (error.code === 11000) {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(500).json({ message: "Error during registration" });
    }
  }
);

authController.post(
  "/login",

  async (req, res) => {
    console.log("🛰️ Request Origin:", req.headers.origin);
    console.log("🌐 Request Referer:", req.headers.referer);
    console.log("🧠 User-Agent:", req.headers["user-agent"]);
    console.log("🔌 Remote IP:", req.ip);
    console.log("🔧 Full Headers:", req.headers);
    console.log("🔴 [Auth Login] Request:", req.body);
    const { email, password, ip } = req.body;

    try {
      // Database login
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
      const { token: refreshToken, jti } = generateRefreshToken(user);

      await storeRefreshToken(user, refreshToken, jti);

      setRefreshTokenCookie(res, refreshToken, req);
      user.lastLogin = new Date();
      await user.save();

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

authController.post("/validate-email", async (req, res) => {
  const { token, locale } = req.query;

  console.log("📧 Email validation request received");
  console.log("   Token:", token ? "Present" : "Missing");

  if (!token) {
    return res.status(400).json({
      message: "Token is required",
      error: "MISSING_TOKEN",
    });
  }
  try {
    console.log("🔐 Verifying JWT token...");
    const decoded = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
    console.log("✅ Token verified, user ID:", decoded.userId);

    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log("❌ User not found for ID:", decoded.userId);
      return res.status(400).json({
        message: "Invalid token - user not found",
        error: "USER_NOT_FOUND",
      });
    }

    console.log(
      "👤 User found:",
      user.email,
      "Validated:",
      user.isEmailValidated
    );

    // Check if email is already validated
    if (user.isEmailValidated) {
      console.log("✅ Email already validated");
      return res.status(200).json({
        message: "Email is already validated.",
        isEmailValidated: true,
      });
    }

    console.log("🔄 Marking email as validated...");
    user.isEmailValidated = true;
    await user.save();

    console.log("🍪 Generating refresh token...");
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();
    setRefreshTokenCookie(res, refreshToken);

    // Registration completed email (optional - disabled for now)
    // console.log('📧 Sending registration completed email...');
    // try {
    //   await sendRegistrationCompletedEmail(user.email, locale);
    // } catch (emailError) {
    //   console.warn('⚠️ Failed to send registration completed email:', emailError.message);
    // }

    console.log("✅ Email validated successfully");
    res.status(200).json({
      message: "Email validated successfully.",
      success: true,
    });
  } catch (error) {
    console.error("❌ Email validation error:", error);

    // Check if the error is a JWT verification error
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      console.log("🔍 Token invalid/expired, checking if already validated...");
      // Try to find user with validated email
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId) {
          const user = await User.findById(decoded.userId);
          if (user && user.isEmailValidated) {
            console.log("✅ Token expired but email already validated");
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

    res.status(400).json({
      message:
        error.name === "TokenExpiredError"
          ? "Validation token has expired. Please request a new one."
          : "Invalid or expired token.",
      error: error.name || "VALIDATION_ERROR",
    });
  }
});

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
        return res.status(200).json({
          message:
            "Email is already validated. You can log in to your account.",
          isEmailValidated: true,
        });
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
    console.log("req incomming");
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
      console.log("resetToken", resetToken);

      console.log("user", user);

      // Ensure reset password URLs point to the patient app
      const patientAppDomain =
        process.env.PATIENT_URL ||
        process.env.PATIENT_APP_DOMAIN ||
        (process.env.NODE_ENV === "development"
          ? "http://localhost:5174" // Patient app runs on 5174 in development
          : process.env.FRONTEND_DOMAIN);

      const resetUrl = `${patientAppDomain}/reset-password?token=${resetToken}`;

      console.log("🔧 Environment variables:");
      console.log("PATIENT_APP_DOMAIN:", process.env.PATIENT_APP_DOMAIN);
      console.log("FRONTEND_DOMAIN:", process.env.FRONTEND_DOMAIN);
      console.log("🔗 Reset URL:", resetUrl);

      console.log("sending email");
      console.log("📧 Email parameters:", {
        email,
        resetUrl,
        locale,
        companyName: user.companyName,
      });

      try {
        await sendForgotPassword(
          email,
          resetUrl,
          locale,
          user.companyName || "Telemediker"
        );
        console.log("✅ Password reset email sent successfully");

        res.status(200).json({
          message: "Password reset email sent successfully",
        });
      } catch (emailError) {
        console.error("❌ Error sending password reset email:", emailError);

        // Still return success to prevent email enumeration attacks
        res.status(200).json({
          message: "Password reset email sent successfully",
        });
      }
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

authController.get("/status", authenticateToken, (req, res) => {
  // Check if the request is authenticated
  // The middleware now sets req.isAuthenticated explicitly
  const isAuthenticated = req.isAuthenticated !== false;

  // If not authenticated, return appropriate response
  if (!isAuthenticated) {
    return res.status(200).json({
      isAuthenticated: false,
    });
  }

  // If authenticated, return user data
  res.status(200).json({
    isAuthenticated: true,
    accessToken: req.accessToken, // Use the accessToken set by the middleware
    userId: req.user._id,
    isAdmin: req.user.isAdmin,
    userType: req.user.userType,
    isPaid:
      req.user.activeSubscription?.status === "active" ||
      req.user.activeSubscription?.status === "trial",
    isProfileComplete: req.user.isProfileComplete || false,
  });
});

authController.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      try {
        const payload = verifyToken(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET
        );

        if (payload && payload.jti) {
          // Find user by token JTI
          const user = await User.findOne({
            "refreshTokens.jti": payload.jti,
          });

          if (user) {
            await invalidateRefreshToken(user, payload.jti);
            await user.save();
          }
        }
      } catch (error) {
        console.error(
          "🔴 [Auth Logout] Error invalidating refresh token:",
          error
        );
        // Continue with logout even if token invalidation fails
      }
    }

    clearRefreshTokenCookie(res, req);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("🔴 [Auth Logout] Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

authController.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create response object with individual address fields for editing
    const profileData = {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: user.email,
      gender: user.gender,
      birthday: user.birthday,
      // Return address as object with individual fields for EditProfile
      address: {
        street: user.address?.street || "",
        number: user.address?.number || "",
        postCode: user.address?.postCode || "",
        city: user.address?.city || "",
        country: {
          code: user.address?.country?.code || "",
          name: user.address?.country?.name || "",
        },
      },
    };

    // Add country-specific data
    if (user.address?.country?.code === "BG") {
      profileData.nationalIdNumber = user.nationalIdNumber || "";
    } else if (user.address?.country?.code === "DE") {
      profileData.insurance = {
        type: user.insurance?.type || "",
        company: user.insurance?.company || "",
        number: user.insurance?.number || "",
      };
    }

    res.status(200).json(profileData);
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ message: "Error fetching profile data" });
  }
});

// PUT /auth/profile - Update profile information (separate from complete-profile)
authController.put("/profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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
      nationalIdNumber,
      insurance,
    } = req.body;

    // Update user data (allow partial updates)
    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (gender) updateData.gender = gender;
    if (birthDate) updateData.birthday = new Date(birthDate);
    if (nationalIdNumber !== undefined)
      updateData.nationalIdNumber = nationalIdNumber;

    // Handle address update
    if (address || addressNumber || postCode || city || country) {
      updateData.address = {
        street: address || user.address?.street || "",
        number: addressNumber || user.address?.number || "",
        postCode: postCode || user.address?.postCode || "",
        city: city || user.address?.city || "",
        country: {
          code: country || user.address?.country?.code || "",
          name: getCountryName(country) || user.address?.country?.name || "",
        },
      };
    }

    // Handle insurance update (for Germany)
    if (insurance && country === "DE") {
      updateData.insurance = {
        type: insurance.type || user.insurance?.type || "",
        company: insurance.company || user.insurance?.company || "",
        number: insurance.number || user.insurance?.number || "",
      };
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(user._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        fullName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        email: updatedUser.email,
        gender: updatedUser.gender,
        birthday: updatedUser.birthday,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Error updating profile" });
  }
});

// Helper function to get country name from code
function getCountryName(countryCode) {
  const countries = {
    BG: "Bulgaria",
    DE: "Germany",
  };
  return countries[countryCode] || "";
}

// Complete profile endpoint for progressive registration
authController.put("/complete-profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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
      nationalIdNumber,
      insurance,
    } = req.body;

    // Update user with additional profile data
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    user.gender = gender;
    user.birthday = birthDate ? new Date(birthDate) : undefined;

    if (address || addressNumber || postCode || city || country) {
      user.address = {
        street: address,
        number: addressNumber,
        postCode,
        city,
        country: {
          code: country,
          name: countryName,
        },
      };
    }

    // Country-specific data
    if (country === "BG") {
      user.nationalIdNumber = nationalIdNumber;
    }

    if (country === "DE" && insurance) {
      user.insurance = insurance;
    }

    // Mark profile as complete
    user.isProfileComplete = true;

    await user.save();

    res.status(200).json({
      message: "Profile completed successfully",
      isProfileComplete: true,
    });
  } catch (error) {
    console.error("Profile completion error:", error);
    res.status(500).json({ message: "Error completing profile" });
  }
});

// Change password endpoint for authenticated users
authController.post(
  "/change-password",
  authenticateToken,
  [
    check("currentPassword")
      .trim()
      .not()
      .isEmpty()
      .withMessage("Current password is required"),
    check("newPassword")
      .trim()
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters long"),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user._id;

      // Get the user from database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // Check if new password is different from current password
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          message: "New password must be different from current password",
        });
      }

      // Hash the new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update user's password
      user.password = hashedNewPassword;
      await user.save();

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Error changing password" });
    }
  }
);

module.exports = authController;
