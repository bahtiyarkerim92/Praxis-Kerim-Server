require("dotenv").config();
const { getEmailFooter } = require("./emailParts/footer");
const getEmailHead = require("./emailParts/head");
const { getEmailHeader } = require("./emailParts/header");
const i18n = require("../config/i18n");

async function getFridayVideoNotificationTemplate(
  notificationData,
  locale = "de"
) {
  try {
    await i18n.changeLanguage(locale);

    const currentYear = new Date().getFullYear();
    const practicePhone =
      process.env.PRACTICE_PHONE || "+49 69 870015360";
    const practiceEmail =
      process.env.PRACTICE_EMAIL || "info@praxiskerim.de";

    const {
      doctorName,
      formattedDate,
      formattedTime,
      patientName,
      patientEmail,
      patientPhone,
      insuranceType,
      insuranceNumber,
      notes,
    } = notificationData || {};

    return `
<!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="${locale}">

  ${getEmailHead(i18n.t("fridayVideoNotification.subject"))}

<body style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
    <div dir="ltr" class="es-wrapper-color" lang="${locale}"
        style="background-color:#f6f6f6">
        <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none"
            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top;background-color:#f6f6f6">
            <tr>
                <td valign="top" style="padding:0;Margin:0">
                    ${getEmailHeader()}
                    <div style="display:none;max-height:0;overflow:hidden;font-size:0;line-height:0;opacity:0;">
                      ${i18n.t("fridayVideoNotification.previewText")}
                    </div>
                    <table cellpadding="0" cellspacing="0" align="center" class="es-content" role="none"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important">
                        <tr>
                            <td align="center" style="padding:0;Margin:0">
                                <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0"
                                    class="es-content-body" role="none"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#ffffff;width:600px;border-radius:12px 12px 0 0">
                                    <tr>
                                        <td align="left"
                                            style="Margin:0;padding-right:20px;padding-left:20px;padding-bottom:30px;padding-top:30px">
                                            <table cellpadding="0" cellspacing="0" width="100%" role="none"
                                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                <tr>
                                                    <td align="center" valign="top"
                                                        style="padding:0;Margin:0;width:560px">
                                                        <table cellpadding="0" cellspacing="0" width="100%"
                                                            role="presentation"
                                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                            <tr>
                                                                <td align="center"
                                                                    style="padding:0;Margin:0;padding-bottom:10px;padding-top:10px;font-size:0px">
                                                                    <img src="https://images-pickup2.s3.eu-north-1.amazonaws.com/confrim-email.png"
                                                                        alt="Neue Videosprechstunde" width="120"
                                                                        style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;height:auto" />
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    style="padding:0;Margin:0;padding-bottom:10px;padding-top:10px">
                                                                    <h1
                                                                        style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:28px;font-style:normal;font-weight:bold;line-height:34px;color:#333333">
                                                                        ${i18n.t("fridayVideoNotification.title")}
                                                                    </h1>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t("fridayVideoNotification.intro")}
                                                                    </p>
                                                                    <p
                                                                        style="Margin:15px 0 0 0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t("fridayVideoNotification.message")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <table cellpadding="0" cellspacing="0" align="center" class="es-content" role="none"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important">
                        <tr>
                            <td align="center" style="padding:0;Margin:0">
                                <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0"
                                    class="es-content-body" role="none"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#ffffff;width:600px">
                                    <tr>
                                        <td align="left" style="Margin:0;padding:20px 20px 10px 20px">
                                            <table cellpadding="0" cellspacing="0" width="100%" role="none"
                                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                <tr>
                                                    <td align="center" valign="top"
                                                        style="padding:0;Margin:0;width:560px">
                                                        <table cellpadding="0" cellspacing="0" width="100%"
                                                            role="presentation"
                                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-bottom:10px">
                                                                    <h2
                                                                        style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:20px;font-style:normal;font-weight:bold;line-height:24px;color:#333333">
                                                                        ${i18n.t("fridayVideoNotification.appointmentDetails")}
                                                                    </h2>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-bottom:10px">
                                                                    <table width="100%" cellpadding="8" cellspacing="0"
                                                                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:separate;border-spacing:0;border:1px solid #eeeeee;border-radius:8px;background-color:#fafafa;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-size:14px;color:#333333">
                                                                        <tr>
                                                                            <td style="border-bottom:1px solid #eeeeee"><strong>${i18n.t(
                                                                              "fridayVideoNotification.date"
                                                                            )}</strong></td>
                                                                            <td style="border-bottom:1px solid #eeeeee">${formattedDate || "-"}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="border-bottom:1px solid #eeeeee"><strong>${i18n.t(
                                                                              "fridayVideoNotification.time"
                                                                            )}</strong></td>
                                                                            <td style="border-bottom:1px solid #eeeeee">${formattedTime || "-"}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><strong>${i18n.t(
                                                                              "fridayVideoNotification.doctor"
                                                                            )}</strong></td>
                                                                            <td>${doctorName || "-"}</td>
                                                                        </tr>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <table cellpadding="0" cellspacing="0" align="center" class="es-content" role="none"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important">
                        <tr>
                            <td align="center" style="padding:0;Margin:0">
                                <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0"
                                    class="es-content-body" role="none"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#ffffff;width:600px;border-radius:0 0 12px 12px">
                                    <tr>
                                        <td align="left" style="Margin:0;padding:10px 20px 30px 20px">
                                            <table cellpadding="0" cellspacing="0" width="100%" role="none"
                                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                <tr>
                                                    <td align="center" valign="top"
                                                        style="padding:0;Margin:0;width:560px">
                                                        <table cellpadding="0" cellspacing="0" width="100%"
                                                            role="presentation"
                                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-bottom:10px">
                                                                    <h2
                                                                        style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:20px;font-style:normal;font-weight:bold;line-height:24px;color:#333333">
                                                                        ${i18n.t("fridayVideoNotification.patientDetails")}
                                                                    </h2>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-bottom:10px">
                                                                    <table width="100%" cellpadding="8" cellspacing="0"
                                                                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:separate;border-spacing:0;border:1px solid #eeeeee;border-radius:8px;background-color:#fafafa;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-size:14px;color:#333333">
                                                                        <tr>
                                                                            <td style="border-bottom:1px solid #eeeeee"><strong>${i18n.t(
                                                                              "fridayVideoNotification.patientName"
                                                                            )}</strong></td>
                                                                            <td style="border-bottom:1px solid #eeeeee">${patientName || "-"}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="border-bottom:1px solid #eeeeee"><strong>${i18n.t(
                                                                              "fridayVideoNotification.patientEmail"
                                                                            )}</strong></td>
                                                                            <td style="border-bottom:1px solid #eeeeee">${patientEmail || "-"}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="border-bottom:1px solid #eeeeee"><strong>${i18n.t(
                                                                              "fridayVideoNotification.patientPhone"
                                                                            )}</strong></td>
                                                                            <td style="border-bottom:1px solid #eeeeee">${patientPhone || "-"}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="border-bottom:1px solid #eeeeee"><strong>${i18n.t(
                                                                              "fridayVideoNotification.insuranceType"
                                                                            )}</strong></td>
                                                                            <td style="border-bottom:1px solid #eeeeee">${insuranceType || "-"}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="border-bottom:1px solid #eeeeee"><strong>${i18n.t(
                                                                              "fridayVideoNotification.insuranceNumber"
                                                                            )}</strong></td>
                                                                            <td style="border-bottom:1px solid #eeeeee">${insuranceNumber || "-"}</td>
                                                                        </tr>
                                                                        ${
                                                                          notes
                                                                            ? `<tr>
                                                                            <td><strong>${i18n.t(
                                                                              "fridayVideoNotification.notes"
                                                                            )}</strong></td>
                                                                            <td>${notes}</td>
                                                                        </tr>`
                                                                            : ""
                                                                        }
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:10px">
                                                                    <p
                                                                        style="Margin:0 0 12px 0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t("fridayVideoNotification.closing")}
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t("fridayVideoNotification.regards")}<br/>
                                                                        ${i18n.t("fridayVideoNotification.team")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <table cellpadding="0" cellspacing="0" align="center" class="es-content" role="none"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important">
                        <tr>
                            <td align="center" style="padding:0;Margin:0">
                                <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0"
                                    class="es-content-body" role="none"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#ffffff;width:600px">
                                    <tr>
                                        <td align="left" style="Margin:0;padding:20px">
                                            <table cellpadding="0" cellspacing="0" width="100%" role="none"
                                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                <tr>
                                                    <td align="center" valign="top"
                                                        style="padding:0;Margin:0;width:560px">
                                                        <table cellpadding="0" cellspacing="0" width="100%"
                                                            role="presentation"
                                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                            <tr>
                                                                <td align="center"
                                                                    style="padding:0;Margin:0;padding-bottom:5px">
                                                                    <p
                                                                        style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-size:13px;color:#999999;line-height:19px">
                                                                        ${i18n.t("appointmentEmail.practiceName") || "Praxis Dr. Kerim"} · ${practicePhone} · ${practiceEmail}
                                                                    </p>
                                                                    <p
                                                                        style="Margin:5px 0 0 0;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-size:12px;color:#bbbbbb;line-height:18px">
                                                                        © ${currentYear} Praxis Dr. Kerim
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    ${getEmailFooter()}
                </td>
            </tr>
        </table>
    </div>
</body>

</html>
    `;
  } catch (error) {
    console.error(
      "Error generating video consultation notification email template:",
      error
    );
    throw error;
  }
}

module.exports = {
  getFridayVideoNotificationTemplate,
};

