require("dotenv").config();
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const i18n = require("i18next");

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
const {
  getAppointmentCancellationTemplate,
} = require("../emailTemplates/appointmentCancellation");
const {
  getAppointmentRescheduleTemplate,
} = require("../emailTemplates/appointmentReschedule");
const {
  getPatientCancellationConfirmationTemplate,
} = require("../emailTemplates/patientCancellationConfirmation");
const {
  getMarketingEmailTemplate,
} = require("../emailTemplates/marketingEmail");

// Create SES service client
const sesClient = new SESClient({
  region: "eu-north-1", // Back to Stockholm
  credentials: {
    accessKeyId: process.env.AWS_SES_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_KEY_ID,
  },
});

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

async function sendAppointmentCancellation(email, appointmentData, locale = "de") {
  const fromEmail = "info@praxiskerim.de";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getAppointmentCancellationTemplate(appointmentData, locale);

    const params = {
      Source: `Praxis Dr. Kerim <${fromEmail}>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("cancellationEmail.subject"),
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
    console.log("Appointment Cancellation Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending appointment cancellation email:", error);
    throw error;
  }
}

async function sendAppointmentReschedule(email, appointmentData, locale = "de") {
  const fromEmail = "info@praxiskerim.de";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getAppointmentRescheduleTemplate(appointmentData, locale);

    const params = {
      Source: `Praxis Dr. Kerim <${fromEmail}>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("rescheduleEmail.subject"),
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
    console.log("Appointment Reschedule Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending appointment reschedule email:", error);
    throw error;
  }
}

async function sendPatientCancellationConfirmation(email, appointmentData, locale = "de") {
  const fromEmail = "info@praxiskerim.de";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getPatientCancellationConfirmationTemplate(appointmentData, locale);

    const params = {
      Source: `Praxis Dr. Kerim <${fromEmail}>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("patientCancellationConfirmation.subject"),
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
    console.log("Patient Cancellation Confirmation Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending patient cancellation confirmation email:", error);
    throw error;
  }
}

async function sendMarketingEmail(email, patientName, subject, content, locale = "de") {
  const fromEmail = "info@praxiskerim.de";

  try {
    const htmlContent = getMarketingEmailTemplate({
      patientName,
      content,
      locale,
    });

    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: "UTF-8",
          },
        },
      },
    };

    const command = new SendEmailCommand(params);
    await sesClient.send(command);
    
    console.log(`✅ Marketing email sent successfully to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error sending marketing email to ${email}:`, error);
    throw error;
  }
}

module.exports = {
  sendAppointmentConfirmation,
  sendOrderConfirmation,
  sendOrderReady,
  sendAppointmentReminder,
  sendAppointmentCancellation,
  sendAppointmentReschedule,
  sendPatientCancellationConfirmation,
  sendMarketingEmail,
};
