const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Create index for date
holidaySchema.index({ date: 1 });

const Holiday = mongoose.model("Holiday", holidaySchema);

module.exports = Holiday;
