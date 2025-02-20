require("dotenv").config();
const authController = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendValidationEmail } = require("../services/mailer");
const {
  setAuthCookies,
  clearAuthCookies,
} = require("../services/cookie/cookieService");
authController.post("/register", async (req, res) => {
  const locale = req.headers["accept-language"] || "en";
  console.log(locale);
  try {
    const {
      firstName,
      lastName,
      birthDate,
      address,
      addressNumber,
      postCode,
      city,
      country,
      email,
      password,
      insuranceType,
      nationalIdNumber,
      ipCountry,
    } = req.body;

    // Validate country code
    if (!country) {
      return res.status(400).json({
        message: "Validation error",
        errors: ["Country code is required"],
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a mapping of country codes to names
    const countryNames = {
      BG: "Bulgaria",
      // Add more country mappings as needed
    };

    // Create new user with mapped data structure
    const user = new User({
      firstName,
      lastName,
      birthday: new Date(birthDate),
      address: {
        street: address,
        number: addressNumber,
        postCode,
        city,
        country: {
          code: country,
          name: countryNames[country] || "Unknown",
        },
      },
      email,
      password: hashedPassword,
      nationalIdNumber,
      insurance: {
        type: insuranceType,
      },
      termsAccepted: true, // You might want to add this to your frontend form
      ipCountry,
    });

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
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }
    res.status(500).json({ message: "Error during registration" });
  }
});

authController.post("/validate-email", async (req, res) => {
  console.log("req");

  const locale = req.headers["accept-language"] || "en";
  const token = req.body.token;
  console.log(token);
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
      return res.status(400).json({ message: "Email is already validated" });
    }

    user.isEmailValidated = true;
    console.log(user);
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();
    console.log(user);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(200).json({ message: "Email validated successfully." });
  } catch (error) {
    res.status(400).send("Invalid or expired token.");
  }
});

authController.post("/resend-validation-email", async (req, res) => {
  const locale = req.headers["accept-language"] || "en";
  const { email } = req.body;

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
    const tokenExpiryTime = 3600;
    const currentTime = Math.floor(Date.now() / 1000);

    // Only check token expiry if emailTokenIssuedAt exists
    if (user.emailTokenIssuedAt) {
      const issuedTime = Math.floor(user.emailTokenIssuedAt.getTime() / 1000);
      if (issuedTime + tokenExpiryTime > currentTime) {
        return res.status(200).json({
          message: "You need to validate your email. Please check your email.",
        });
      }
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
