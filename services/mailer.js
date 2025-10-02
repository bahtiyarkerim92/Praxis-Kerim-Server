require("dotenv").config();
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const i18n = require("i18next");

const { getConfirmEmailTemplate } = require("../emailTemplates/confirmEmail");
const { getResetPasswordTemplate } = require("../emailTemplates/resetPassword");

// Create SES service client
const sesClient = new SESClient({
  region: "eu-north-1", // Back to Stockholm
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },
});

// /**
//  * Send email using AWS SES
//  * @param {string} to - Recipient email address
//  * @param {string} subject - Email subject
//  * @param {string} body - Email body (HTML)
//  * @returns {Promise} - Returns a promise that resolves with the sending result
//  */

async function sendValidationEmail(email, token, locale) {
  // Use patient app URL for email validation instead of marketing website
  let patientAppDomain =
    process.env.PATIENT_URL ||
    process.env.PATIENT_APP_DOMAIN ||
    "http://localhost:5173";

  // Remove trailing slash if present to avoid double slashes
  patientAppDomain = patientAppDomain.replace(/\/$/, "");

  const validationUrl = `${patientAppDomain}/validate-email?token=${token}`;
  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "info@telemediker.com";

  console.log("🔗 Generating validation email:");
  console.log("   PATIENT_URL:", process.env.PATIENT_URL);
  console.log("   Final domain:", patientAppDomain);
  console.log("   Validation URL:", validationUrl);

  try {
    const htmlContent = await getConfirmEmailTemplate(validationUrl, locale);

    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18n.t("email.confirmEmail.title", { lng: locale }),
        },
        Body: {
          Html: {
            Data: htmlContent,
          },
        },
      },
    };

    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log("Validation Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending validation email:", error);
    throw error;
  }
}

async function sendForgotPassword(email, resetUrl, locale, companyName) {
  try {
    console.log("mailer", locale);
    const htmlContent = await getResetPasswordTemplate(
      resetUrl,
      locale,
      companyName
    );

    const params = {
      Source: "Telemediker <info@telemediker.com>", // Verify this sender in SES
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: "Password Reset",
        },
        Body: {
          Html: {
            Data: htmlContent,
          },
        },
      },
    };

    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log("Forgot Password Email sent:dadadadada ");
    return response;
  } catch (error) {
    console.error("Error sending Forgot Password email:", error);
    throw error;
  }
}
module.exports = {
  sendValidationEmail,
  sendForgotPassword,
};
