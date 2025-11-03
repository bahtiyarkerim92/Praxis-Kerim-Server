require("dotenv").config();
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const i18n = require("i18next");

const { getConfirmEmailTemplate } = require("../emailTemplates/confirmEmail");
const { getResetPasswordTemplate } = require("../emailTemplates/resetPassword");
const {
  getAppointmentConfirmationTemplate,
} = require("../emailTemplates/appointmentConfirmation");
const {
  getOrderConfirmationTemplate,
} = require("../emailTemplates/orderConfirmation");
const {
  getOrderReadyTemplate,
} = require("../emailTemplates/orderReady");
const {
  getAppointmentReminderTemplate,
} = require("../emailTemplates/appointmentReminder");

// Create SES service client
const sesClient = new SESClient({
  region: "eu-north-1", // Back to Stockholm
  credentials: {
    accessKeyId: process.env.AWS_SES_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_KEY_ID,
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
  const patientAppDomain =
    process.env.PATIENT_APP_DOMAIN || "http://localhost:5173";
  const validationUrl = `${patientAppDomain}/validate-email?token=${token}`;
  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "info@telemediker.com";

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
async function sendAppointmentConfirmation(
  email,
  appointmentData,
  locale = "de"
) {
  const fromEmail = "info@praxiskerim.de";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getAppointmentConfirmationTemplate(
      appointmentData,
      locale
    );

    const params = {
      Source: `Praxis Kerim <${fromEmail}>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("appointmentEmail.subject"),
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
    console.log("Appointment Confirmation Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending appointment confirmation email:", error);
    throw error;
  }
}

async function sendOrderConfirmation(email, orderData, locale = "de") {
  const fromEmail = "info@praxiskerim.de";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getOrderConfirmationTemplate(orderData, locale);

    const params = {
      Source: `Praxis Dr. Kerim <${fromEmail}>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("orderEmail.subject"),
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
    console.log("Order Confirmation Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    throw error;
  }
}

async function sendOrderReady(email, orderData, locale = "de") {
  const fromEmail = "info@praxiskerim.de";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getOrderReadyTemplate(orderData, locale);

    const params = {
      Source: `Praxis Dr. Kerim <${fromEmail}>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("orderReadyEmail.subject"),
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
    console.log("Order Ready Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending order ready email:", error);
    throw error;
  }
}

async function sendAppointmentReminder(email, appointmentData, reminderType = "24h", locale = "de") {
  const fromEmail = "info@praxiskerim.de";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    // Get translated time for subject
    const reminderTimeKey = reminderType === "24h" ? "reminderEmail.time24h" : "reminderEmail.time2h";
    const timeText = i18nServer.t(reminderTimeKey);
    
    const htmlContent = await getAppointmentReminderTemplate(appointmentData, reminderType, locale);

    const params = {
      Source: `Praxis Dr. Kerim <${fromEmail}>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("reminderEmail.subject", { time: timeText }),
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
    console.log(`Appointment Reminder (${reminderType}) Email sent:`, response.MessageId);
    return response;
  } catch (error) {
    console.error(`Error sending appointment reminder (${reminderType}) email:`, error);
    throw error;
  }
}

module.exports = {
  sendValidationEmail,
  sendForgotPassword,
  sendAppointmentConfirmation,
  sendOrderConfirmation,
  sendOrderReady,
  sendAppointmentReminder,
};
