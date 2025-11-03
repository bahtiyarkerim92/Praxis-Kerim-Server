require("dotenv").config();
const { sendOrderReady } = require("../services/mailer");

// Test order ready emails in all supported languages
async function testOrderReadyEmail() {
  const testEmail = process.argv[2] || "hasanovh14@gmail.com";

  console.log("Testing Order Ready Emails...\n");
  console.log("Sending test emails to:", testEmail);
  console.log("----------------------------------------\n");

  const testOrderData = {
    patientName: "Max Mustermann",
  };

  const languages = [
    { code: "de", name: "German" },
    { code: "en", name: "English" },
    { code: "tr", name: "Turkish" },
    { code: "bg", name: "Bulgarian" },
    { code: "pl", name: "Polish" },
  ];

  try {
    for (const lang of languages) {
      console.log(`${lang.name} (${lang.code})...`);
      await sendOrderReady(testEmail, testOrderData, lang.code);
      console.log(`✓ Order ready email (${lang.name}) sent successfully!\n`);
      
      // Add a small delay between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("✅ All test emails sent successfully!");
    console.log(`Check your inbox at: ${testEmail}`);
  } catch (error) {
    console.error("❌ Error sending test emails:", error);
    process.exit(1);
  }
}

testOrderReadyEmail();

