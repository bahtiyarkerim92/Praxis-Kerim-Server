require("dotenv").config();
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const i18n = require("i18next");

const { getConfirmEmailTemplate } = require("../emailTemplates/confirmEmail");
const { getResetPasswordTemplate } = require("../emailTemplates/resetPassword");

// Create SES service client
const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION,
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
  const validationUrl = `${process.env.FRONTEND_DOMAIN}${locale}/validate-email?token=${token}`;

  try {
    const htmlContent = await getConfirmEmailTemplate(validationUrl, locale);

    const params = {
      Source: "Telemediker <info@telemediker.com>",
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
