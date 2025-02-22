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
    },
    number: {
      type: String,
      required: true,
      trim: true,
    },
    postCode: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      code: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
      },
      name: {
        type: String,
        required: true,
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
  refreshToken: String,

  emailTokenIssuedAt: Date,
  resetPasswordToken: String,
  resetPasswordExpires: { type: Date },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
