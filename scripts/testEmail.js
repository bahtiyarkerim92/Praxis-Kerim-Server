require("dotenv").config();
const { sendAppointmentConfirmation } = require("../services/mailer");

// Test email sending
async function testEmail() {
  try {
    console.log("Testing email configuration...");
    console.log("AWS Region: eu-north-1");
    console.log("From: info@praxiskerim.de");
    console.log("Credentials loaded:", {
      accessKeyId: process.env.AWS_SES_KEY_ID ? "SET" : "NOT SET",
      secretKey: process.env.AWS_SES_SECRET_KEY_ID ? "SET" : "NOT SET",
    });

    const testAppointment = {
      doctorName: "Dr. Test",
      date: new Date(),
      slot: "10:30",
      title: "Test Appointment",
      description: "This is a test email",
    };

    // Replace with your verified email address
    const testEmail = "b.kerim@hotmail.com"; // CHANGE THIS!

    console.log(`\nSending test email to: ${testEmail}`);
    await sendAppointmentConfirmation(testEmail, testAppointment, "de");

    console.log("\n✅ Test email sent successfully!");
    console.log("Check your inbox for the confirmation email.");
  } catch (error) {
    console.error("\n❌ Error sending test email:");
    console.error(error.message);

    if (error.message.includes("not verified")) {
      console.log("\n⚠️  The email address is not verified in AWS SES.");
      console.log("Please verify the email in AWS SES Console first.");
    }

    if (error.message.includes("credential")) {
      console.log("\n⚠️  AWS credentials are invalid or not set.");
      console.log(
        "Check your .env file for AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY"
      );
    }
  }

  process.exit();
}

testEmail();
