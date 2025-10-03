const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
    specialties: [
      {
        type: String,
        trim: true,
      },
    ],
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    photoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    experience: {
      type: Number, // years of experience
      min: 0,
    },
    // Rating system
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDoctor: {
      type: Boolean,
      default: true, // Default to doctor role
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    countriesOfOperation: [
      {
        type: String,
        trim: true,
      },
    ],
    languages: [
      {
        type: String,
        trim: true,
      },
    ],
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Update the updatedAt field before saving
doctorSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Doctor = mongoose.model("Doctor", doctorSchema);

module.exports = Doctor;
