require("dotenv").config();
const { sendAppointmentReminder } = require("../services/mailer");

async function testReminderEmails() {
  console.log("Testing Appointment Reminder Emails...\n");

  // Test appointment data
  const testData = {
    patientName: "Max Mustermann",
    doctorName: "Dr. Ibrahim Kerim",
    date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  };

  // Get email from command line or use default
  const testEmail = process.argv[2] || "test@example.com";
  
  console.log(`Sending test emails to: ${testEmail}\n`);

  try {
    // Test 24-hour reminder in German
    console.log("1. Sending 24-hour reminder in German...");
    await sendAppointmentReminder(testEmail, testData, "24h", "de");
    console.log("✓ 24-hour reminder (German) sent successfully!\n");

    // Wait 2 seconds between sends
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2-hour reminder in English
    console.log("2. Sending 2-hour reminder in English...");
    await sendAppointmentReminder(testEmail, testData, "2h", "en");
    console.log("✓ 2-hour reminder (English) sent successfully!\n");

    // Wait 2 seconds between sends
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 24-hour reminder in Turkish
    console.log("3. Sending 24-hour reminder in Turkish...");
    await sendAppointmentReminder(testEmail, testData, "24h", "tr");
    console.log("✓ 24-hour reminder (Turkish) sent successfully!\n");

    console.log("✅ All test emails sent successfully!");
    console.log(`Check your inbox at: ${testEmail}`);
  } catch (error) {
    console.error("❌ Error sending test emails:", error.message);
    process.exit(1);
  }
}

// Run the test
testReminderEmails()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

