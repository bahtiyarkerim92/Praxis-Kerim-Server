require("dotenv").config();
const { sendPatientCancellationConfirmation } = require("../services/mailer");

// Test data
const testEmail = "your-email@example.com"; // CHANGE THIS
const appointmentData = {
  doctorName: "Dr. Sarah Schmidt",
  date: new Date("2025-11-15T00:00:00.000Z"),
  slot: "14:30",
};

const languages = ["de", "en", "bg", "pl", "tr"];

async function testPatientCancellationEmails() {
  console.log("============================================================");
  console.log("🧪 TESTING PATIENT CANCELLATION CONFIRMATION EMAILS");
  console.log("============================================================");
  console.log(`📧 Sending to: ${testEmail}`);
  console.log(`📅 Cancelled Appointment: ${appointmentData.doctorName} on ${appointmentData.date}`);
  console.log(`⏰ Time: ${appointmentData.slot}`);
  console.log("============================================================\n");

  for (const lang of languages) {
    try {
      console.log(`📤 Sending ${lang.toUpperCase()} cancellation confirmation email...`);
      await sendPatientCancellationConfirmation(testEmail, appointmentData, lang);
      console.log(`✅ ${lang.toUpperCase()} email sent successfully!\n`);
      
      // Wait 2 seconds between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Failed to send ${lang.toUpperCase()} email:`, error.message, "\n");
    }
  }

  console.log("============================================================");
  console.log("✅ Test completed!");
  console.log("============================================================");
}

// Run the test
testPatientCancellationEmails()
  .then(() => {
    console.log("\n✨ All tests completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });

