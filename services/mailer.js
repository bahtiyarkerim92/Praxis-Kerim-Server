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
  getOrderMissingInsuranceTemplate,
} = require("../emailTemplates/orderMissingInsurance");
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
const {
  getFridayVideoNotificationTemplate,
} = require("../emailTemplates/fridayVideoNotification");
const { getLocalizedDoctorName } = require("../utils/doctor");

// Create SES service client
const sesClient = new SESClient({
  region: "eu-north-1", // Back to Stockholm
  credentials: {
    accessKeyId: process.env.AWS_SES_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_KEY_ID,
  },
});

const DEFAULT_FROM_EMAIL =
  process.env.PRACTICE_EMAIL_SENDER || "Praxis Dr. Kerim <info@praxiskerim.de>";

async function sendAppointmentConfirmation(
  email,
  appointmentData,
  locale = "de"
) {
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const localizedAppointmentData = appointmentData
      ? {
          ...appointmentData,
          doctorName: getLocalizedDoctorName(
            appointmentData.doctorName,
            i18nServer
          ),
        }
      : appointmentData;

    const htmlContent = await getAppointmentConfirmationTemplate(
      localizedAppointmentData,
      locale
    );

    const params = {
      Source: fromEmail,
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
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getOrderConfirmationTemplate(orderData, locale);

    const params = {
      Source: fromEmail,
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
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    const htmlContent = await getOrderReadyTemplate(orderData, locale);

    const params = {
      Source: fromEmail,
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

async function sendOrderMissingInsurance(email, orderData, locale = "de") {
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);

    const htmlContent = await getOrderMissingInsuranceTemplate(
      orderData,
      locale
    );

    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("orderMissingInsurance.subject"),
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
    console.log("Order missing insurance email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending order missing insurance email:", error);
    throw error;
  }
}

async function sendAppointmentReminder(email, appointmentData, reminderType = "24h", locale = "de") {
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);
    
    // Get translated time for subject
    const reminderTimeKey = reminderType === "24h" ? "reminderEmail.time24h" : "reminderEmail.time2h";
    const timeText = i18nServer.t(reminderTimeKey);

    const localizedAppointmentData = appointmentData
      ? {
          ...appointmentData,
          doctorName: getLocalizedDoctorName(
            appointmentData.doctorName,
            i18nServer
          ),
        }
      : appointmentData;

    const htmlContent = await getAppointmentReminderTemplate(
      localizedAppointmentData,
      reminderType,
      locale
    );

    const params = {
      Source: fromEmail,
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
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);

    const localizedAppointmentData = appointmentData
      ? {
          ...appointmentData,
          doctorName: getLocalizedDoctorName(
            appointmentData.doctorName,
            i18nServer
          ),
        }
      : appointmentData;

    const htmlContent = await getAppointmentCancellationTemplate(
      localizedAppointmentData,
      locale
    );

    const params = {
      Source: fromEmail,
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
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);

    const localizedAppointmentData = appointmentData
      ? {
          ...appointmentData,
          doctorName: getLocalizedDoctorName(
            appointmentData.doctorName,
            i18nServer
          ),
        }
      : appointmentData;

    const htmlContent = await getAppointmentRescheduleTemplate(
      localizedAppointmentData,
      locale
    );

    const params = {
      Source: fromEmail,
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
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);

    const localizedAppointmentData = appointmentData
      ? {
          ...appointmentData,
          doctorName: getLocalizedDoctorName(
            appointmentData.doctorName,
            i18nServer
          ),
        }
      : appointmentData;

    const htmlContent = await getPatientCancellationConfirmationTemplate(
      localizedAppointmentData,
      locale
    );

    const params = {
      Source: fromEmail,
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

async function sendMarketingEmail(
  email,
  patientName,
  subject,
  content,
  locale = "de"
) {
  const fromEmail = DEFAULT_FROM_EMAIL;
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);

    const htmlContent = getMarketingEmailTemplate({
      patientName,
      content,
      locale,
      i18n: i18nServer,
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

async function sendFridayVideoNotification(notificationData, locale = "de") {
  const practiceEmail =
    process.env.PRACTICE_TEAM_EMAIL ||
    process.env.PRACTICE_EMAIL ||
    "info@praxiskerim.de";
  const fromEmail =
    process.env.PRACTICE_EMAIL ||
    process.env.PRACTICE_TEAM_EMAIL ||
    "Praxis Dr. Kerim <info@praxiskerim.de>";
  const i18nServer = require("../config/i18n");

  try {
    await i18nServer.changeLanguage(locale);

    const htmlContent = await getFridayVideoNotificationTemplate(
      notificationData,
      locale
    );

    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: [practiceEmail],
      },
      Message: {
        Subject: {
          Data: i18nServer.t("fridayVideoNotification.subject"),
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
    console.log(
      "Video consultation notification email sent:",
      response.MessageId
    );
    return response;
  } catch (error) {
    console.error(
      "Error sending video consultation notification email:",
      error
    );
    throw error;
  }
}

module.exports = {
  sendAppointmentConfirmation,
  sendOrderConfirmation,
  sendOrderReady,
  sendOrderMissingInsurance,
  sendAppointmentReminder,
  sendAppointmentCancellation,
  sendAppointmentReschedule,
  sendPatientCancellationConfirmation,
  sendMarketingEmail,
  sendFridayVideoNotification,
};
