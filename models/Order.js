const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    patient: {
      vorname: { type: String, required: true },
      nachname: { type: String, required: true },
      telefon: { type: String, required: true },
      email: { type: String, required: true },
      strasse: { type: String, required: true },
      hausnummer: { type: String, required: true },
      plz: { type: String, required: true },
      stadt: { type: String, required: true },
      versicherungsart: {
        type: String,
        enum: ["gesetzlich", "privat"],
        required: true,
      },
      versicherungsnummer: { type: String, required: true },
    },
    orders: [
      {
        type: {
          type: String,
          enum: ["rezept", "ueberweisung", "krankenschein"],
          required: true,
        },
        erlaeuterung: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled"],
      default: "pending",
    },
    locale: {
      type: String,
      default: "de",
      enum: ["de", "en", "bg", "pl", "tr"],
    },
  },
  { timestamps: true }
);

// Create index for status
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
