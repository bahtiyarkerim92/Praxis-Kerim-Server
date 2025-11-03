require("dotenv").config();
const {
  sendOrderConfirmation,
  sendAppointmentReminder,
} = require("../services/mailer");

async function testAllEmails() {
  console.log("=".repeat(60));
  console.log("Testing ALL Email Types - Order & Reminder");
  console.log("=".repeat(60));
  console.log();

  // Get email from command line or use default
  const testEmail = process.argv[2] || "test@example.com";

  if (testEmail === "test@example.com") {
    console.log("⚠️  WARNING: Using default test email.");
    console.log("   Run with: node scripts/testAllEmails.js your-email@example.com\n");
  }

  console.log(`📧 Sending test emails to: ${testEmail}\n`);

  // Test data
  const testOrderData = {
    patientName: "Max Mustermann",
    orderNumber: "TEST-" + Date.now(),
    orderType: "Rezept, Überweisung, Krankenschein",
    description: "Rezept: Blutdruckmedikament; Überweisung: Kardiologe; Krankenschein: Arbeitsunfähigkeit",
    createdAt: new Date(),
    _id: "test" + Date.now(),
  };

  const testAppointmentData = {
    patientName: "Maria Schmidt",
    doctorName: "Dr. Ibrahim Kerim",
    date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  };

  const languages = [
    { code: "de", name: "German (Deutsch)" },
    { code: "en", name: "English" },
    { code: "bg", name: "Bulgarian (Български)" },
    { code: "pl", name: "Polish (Polski)" },
    { code: "tr", name: "Turkish (Türkçe)" },
  ];

  try {
    console.log("📦 TESTING ORDER CONFIRMATION EMAILS");
    console.log("-".repeat(60));

    for (const lang of languages) {
      console.log(`\n${lang.name} (${lang.code})...`);
      await sendOrderConfirmation(testEmail, testOrderData, lang.code);
      console.log(`  ✓ Order confirmation sent`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log("\n" + "=".repeat(60));
    console.log("🔔 TESTING APPOINTMENT REMINDER EMAILS");
    console.log("-".repeat(60));

    for (const lang of languages) {
      console.log(`\n${lang.name} (${lang.code})...`);
      
      // 24-hour reminder
      await sendAppointmentReminder(
        testEmail,
        testAppointmentData,
        "24h",
        lang.code
      );
      console.log(`  ✓ 24-hour reminder sent`);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 2-hour reminder
      await sendAppointmentReminder(
        testEmail,
        testAppointmentData,
        "2h",
        lang.code
      );
      console.log(`  ✓ 2-hour reminder sent`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log();
    console.log(`Total emails sent: ${languages.length * 3} emails`);
    console.log(`  • ${languages.length} Order Confirmations`);
    console.log(`  • ${languages.length * 2} Appointment Reminders (24h + 2h)`);
    console.log();
    console.log(`📬 Check your inbox at: ${testEmail}`);
    console.log();
    console.log("What to verify:");
    console.log("  ✓ All emails arrived");
    console.log("  ✓ Correct language for each email");
    console.log("  ✓ Proper date/time formatting");
    console.log("  ✓ All data displays correctly");
    console.log("  ✓ Links are working");
    console.log("  ✓ Mobile responsive design");
    console.log();
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
console.log("\nStarting email tests...\n");
testAllEmails()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

