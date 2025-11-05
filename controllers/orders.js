const express = require("express");
const { body, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const Order = require("../models/Order");
const { sendOrderConfirmation, sendOrderReady } = require("../services/mailer");
const { createOrUpdatePatient } = require("../services/patientService");

const router = express.Router();

// Helper function
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// Validation rules
const orderValidationRules = [
  body("patient.vorname")
    .trim()
    .notEmpty()
    .withMessage("Vorname ist erforderlich"),
  body("patient.nachname")
    .trim()
    .notEmpty()
    .withMessage("Nachname ist erforderlich"),
  body("patient.telefon")
    .trim()
    .notEmpty()
    .withMessage("Telefon ist erforderlich"),
  body("patient.email").isEmail().withMessage("Gültige E-Mail erforderlich"),
  body("patient.strasse")
    .trim()
    .notEmpty()
    .withMessage("Straße ist erforderlich"),
  body("patient.hausnummer")
    .trim()
    .notEmpty()
    .withMessage("Hausnummer ist erforderlich"),
  body("patient.plz")
    .matches(/^[0-9]{5}$/)
    .withMessage("PLZ muss 5 Ziffern haben"),
  body("patient.stadt").trim().notEmpty().withMessage("Stadt ist erforderlich"),
  body("patient.versicherungsart")
    .isIn(["gesetzlich", "privat"])
    .withMessage("Versicherungsart ungültig"),
  body("patient.versicherungsnummer")
    .trim()
    .notEmpty()
    .withMessage("Versicherungsnummer ist erforderlich"),
  body("orders")
    .isArray({ min: 1 })
    .withMessage("Mindestens eine Bestellung erforderlich"),
];

// GET /api/orders - Get all orders (ADMIN only)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      message: "Error fetching orders",
      error: error.message,
    });
  }
});

// GET /api/orders/:id - Get specific order (ADMIN only)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return res.status(500).json({
      message: "Error fetching order",
      error: error.message,
    });
  }
});

// POST /api/orders - Create new order (PUBLIC - no auth)
router.post(
  "/",
  orderValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { patient, orders, locale } = req.body;

      const order = new Order({
        patient,
        orders,
        status: "pending",
        locale: locale || "de",
      });

      await order.save();

      // Save patient record for marketing (only if email doesn't exist)
      try {
        const patientName = `${patient.vorname} ${patient.nachname}`;
        await createOrUpdatePatient({
          name: patientName,
          email: patient.email,
          phone: patient.telefon || "",
        });
      } catch (patientError) {
        console.error("Error saving patient record:", patientError);
        // Don't fail order creation if patient save fails
      }

      // Send confirmation email
      try {
        const patientName = `${patient.vorname} ${patient.nachname}`;
        const orderType = orders.map((o) => o.type).join(", ");
        const description = orders
          .map((o) => `${o.type}${o.details ? ": " + o.details : ""}`)
          .join("; ");

        const emailLocale = locale || "de"; // Default to German if no locale provided

        await sendOrderConfirmation(
          patient.email,
          {
            patientName,
            orderNumber: order._id.toString(),
            orderType,
            description,
            createdAt: order.createdAt,
            _id: order._id,
          },
          emailLocale
        );
        console.log(
          `Order confirmation email sent to: ${patient.email} (locale: ${emailLocale})`
        );
      } catch (emailError) {
        console.error("Error sending order confirmation email:", emailError);
        // Don't fail the order creation if email fails
      }

      return res.status(201).json({
        success: true,
        message: "Bestellung erfolgreich erstellt",
        order: {
          _id: order._id,
          status: order.status,
        },
      });
    } catch (error) {
      console.error("Error creating order:", error);
      return res.status(500).json({
        message: "Error creating order",
        error: error.message,
      });
    }
  }
);

// PATCH /api/orders/:id - Update order status (ADMIN only)
router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "processing", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    // Get current order to check previous status
    const currentOrder = await Order.findById(req.params.id);

    if (!currentOrder) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const previousStatus = currentOrder.status;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    // Send "Order Ready" email when status changes to "completed"
    if (status === "completed" && previousStatus !== "completed") {
      try {
        const patientFullName = `${order.patient.vorname} ${order.patient.nachname}`.trim();
        const locale = order.locale || "de"; // Use locale from order or default to German

        await sendOrderReady(
          order.patient.email,
          {
            patientName: patientFullName,
          },
          locale
        );
        console.log(
          `✅ Order ready email sent to: ${order.patient.email} (locale: ${locale})`
        );
      } catch (emailError) {
        // Log email error but don't fail the status update
        console.error("❌ Failed to send order ready email:", emailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated",
      order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return res.status(500).json({
      message: "Error updating order",
      error: error.message,
    });
  }
});

// DELETE /api/orders/:id - Delete order (ADMIN only)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    return res.status(500).json({
      message: "Error deleting order",
      error: error.message,
    });
  }
});

module.exports = router;
