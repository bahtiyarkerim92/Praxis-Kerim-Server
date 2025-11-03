require("dotenv").config();
const { sendOrderConfirmation } = require("../services/mailer");

async function testOrderEmails() {
  console.log("Testing Order Confirmation Emails...\n");

  // Test order data
  const testOrderData = {
    patientName: "Max Mustermann",
    orderNumber: "TEST-" + Date.now(),
    orderType: "Rezept, Überweisung",
    description: "Rezept: Blutdruckmedikament; Überweisung: Kardiologe",
    createdAt: new Date(),
    _id: "test123456",
  };

  // Get email from command line or use default
  const testEmail = process.argv[2] || "test@example.com";
  
  console.log(`Sending test emails to: ${testEmail}\n`);

  try {
    // Test in German
    console.log("1. Sending order confirmation in German...");
    await sendOrderConfirmation(testEmail, testOrderData, "de");
    console.log("✓ Order confirmation (German) sent successfully!\n");

    // Wait 2 seconds between sends
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test in English
    console.log("2. Sending order confirmation in English...");
    await sendOrderConfirmation(testEmail, testOrderData, "en");
    console.log("✓ Order confirmation (English) sent successfully!\n");

    // Wait 2 seconds between sends
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test in Bulgarian
    console.log("3. Sending order confirmation in Bulgarian...");
    await sendOrderConfirmation(testEmail, testOrderData, "bg");
    console.log("✓ Order confirmation (Bulgarian) sent successfully!\n");

    console.log("✅ All test emails sent successfully!");
    console.log(`Check your inbox at: ${testEmail}`);
  } catch (error) {
    console.error("❌ Error sending test emails:", error.message);
    process.exit(1);
  }
}

// Run the test
testOrderEmails()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
