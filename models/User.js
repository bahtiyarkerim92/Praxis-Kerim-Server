const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
  },
  birthday: {
    type: Date,
  },
  address: {
    street: {
      type: String,
      trim: true,
    },
    number: {
      type: String,
      trim: true,
    },
    postCode: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    country: {
      code: {
        type: String,
        uppercase: true,
        trim: true,
      },
      name: {
        type: String,
        trim: true,
      },
    },
  },
  ipCountry: {
    type: String,
    trim: true,
  },
  nationalIdNumber: {
    type: String,
  },
  isExistingPatient: {
    type: Boolean,
  },
  insurance: {
    type: {
      type: String,
      enum: ["state", "private"],
    },
    company: {
      type: String,
    },
    number: {
      type: String,
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  termsAccepted: {
    type: Boolean,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isEmailValidated: {
    type: Boolean,
    default: false,
  },
  isProfileComplete: {
    type: Boolean,
    default: false,
  },
  refreshTokens: {
    type: [
      {
        token: { type: String, required: false },
        jti: { type: String, required: false },
        createdAt: { type: Date, default: Date.now },
        invalidated: { type: Boolean, default: false },
      },
    ],
    default: [],
  },

  emailTokenIssuedAt: Date,
  resetPasswordToken: String,
  resetPasswordExpires: { type: Date },

  isAdmin: {
    type: Boolean,
    default: false,
  },

  registrationDate: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
