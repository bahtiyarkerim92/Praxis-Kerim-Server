require("dotenv").config();
const { sendAppointmentCancellation } = require("../services/mailer");

/**
 * Test script to manually test appointment cancellation email
 * 
 * Usage:
 * node scripts/testCancellationEmail.js [locale]
 * 
 * Examples:
 * node scripts/testCancellationEmail.js
 * node scripts/testCancellationEmail.js en
 * node scripts/testCancellationEmail.js bg
 */

async function testCancellationEmail() {
  // Get locale from command line argument or default to 'de'
  const locale = process.argv[2] || "de";
  const validLocales = ["de", "en", "bg", "pl", "tr"];

  if (!validLocales.includes(locale)) {
    console.error(`❌ Invalid locale: ${locale}`);
    console.error(`Valid locales: ${validLocales.join(", ")}`);
    process.exit(1);
  }

  console.log("\n============================================================");
  console.log("🧪 Testing Appointment Cancellation Email");
  console.log("============================================================");
  console.log(`Locale: ${locale}`);
  console.log(`Test Email: ${process.env.TEST_EMAIL || "your-email@example.com"}`);
  console.log("============================================================\n");

  // Check if TEST_EMAIL is configured
  if (!process.env.TEST_EMAIL) {
    console.error("❌ Error: TEST_EMAIL environment variable is not set");
    console.error("Please add TEST_EMAIL=your-email@example.com to your .env file");
    process.exit(1);
  }

  // Sample appointment data
  const appointmentData = {
    doctorName: "Dr. Ibrahim Kerim",
    date: new Date("2025-11-10T00:00:00.000Z"),
    slot: "10:30",
  };

  try {
    console.log("📧 Sending test cancellation email...\n");

    await sendAppointmentCancellation(
      process.env.TEST_EMAIL,
      appointmentData,
      locale
    );

    console.log("\n✅ Test cancellation email sent successfully!");
    console.log(`📬 Check your inbox at: ${process.env.TEST_EMAIL}`);
    console.log("\n============================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error sending test cancellation email:");
    console.error(error);
    console.log("\n============================================================");
    process.exit(1);
  }
}

// Run the test
testCancellationEmail();

