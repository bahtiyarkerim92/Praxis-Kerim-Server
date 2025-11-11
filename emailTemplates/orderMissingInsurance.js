require("dotenv").config();
const { getEmailFooter } = require("./emailParts/footer");
const getEmailHead = require("./emailParts/head");
const { getEmailHeader } = require("./emailParts/header");
const i18n = require("../config/i18n");

async function getOrderMissingInsuranceTemplate(orderData, locale = "de") {
  try {
    await i18n.changeLanguage(locale);

    const currentYear = new Date().getFullYear();
    const practicePhone = process.env.PRACTICE_PHONE || "+49 69 870015360";
    const practiceEmail = process.env.PRACTICE_EMAIL || "info@praxiskerim.de";

    return `
<!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="${locale}">

  ${getEmailHead(i18n.t("orderMissingInsurance.subject"))}

<body class="body"
    style="width:100%;height:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
    <div dir="ltr" class="es-wrapper-color" lang="${locale}" style="background-color:#FAFAFA">
        <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none"
            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top;background-color:#FAFAFA">
            <tr>
                <td valign="top" style="padding:0;Margin:0">
                    ${getEmailHeader()}
                    <div style="display:none; max-height:0; overflow:hidden; font-size:0; line-height:0; opacity:0;">
                      ${i18n.t("orderMissingInsurance.previewText")}
                    </div>
                    <table cellpadding="0" cellspacing="0" align="center" class="es-content" role="none"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important">
                        <tr>
                            <td align="center" style="padding:0;Margin:0">
                                <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0"
                                    class="es-content-body" role="none"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;width:600px">
                                    <tr>
                                        <td align="left"
                                            style="Margin:0;padding-right:20px;padding-left:20px;padding-top:30px;padding-bottom:30px">
                                            <table cellpadding="0" cellspacing="0" width="100%" role="none"
                                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                <tr>
                                                    <td align="center" valign="top" style="padding:0;Margin:0;width:560px">
                                                        <table cellpadding="0" cellspacing="0" width="100%"
                                                            role="presentation"
                                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                            <tr>
                                                                <td align="center"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px;font-size:0px">
                                                                    <img src="https://images-pickup2.s3.eu-north-1.amazonaws.com/confrim-email.png"
                                                                        alt="Insurance card required" height="100"
                                                                        style="display:block;font-size:14px;border:0;outline:none;text-decoration:none"
                                                                        width="110" />
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
                                                                    <h1 style="Margin:0;font-family:arial,'helvetica neue',helvetica,sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:28px;font-weight:bold;line-height:34px;color:#333333">
                                                                        ${i18n.t("orderMissingInsurance.title")}
                                                                    </h1>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px;padding-left:10px;padding-right:10px">
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderMissingInsurance.greeting", {
                                                                          patientName: orderData.patientName || "",
                                                                        })}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:5px;padding-bottom:10px;padding-left:10px;padding-right:10px">
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderMissingInsurance.message1")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:5px;padding-bottom:10px;padding-left:10px;padding-right:10px">
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderMissingInsurance.message2")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:5px;padding-bottom:10px;padding-left:10px;padding-right:10px">
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderMissingInsurance.message3")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:15px;padding-bottom:15px;padding-left:10px;padding-right:10px;background-color:#FFF5E5;border-radius:10px">
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#D97706;font-size:14px;font-weight:bold">
                                                                        ${i18n.t("orderMissingInsurance.highlight")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:20px;padding-bottom:10px;padding-left:10px;padding-right:10px">
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        <strong>${i18n.t("orderMissingInsurance.contactTitle")}</strong><br /><br />
                                                                        📞 ${i18n.t("orderMissingInsurance.phone")} <a href="tel:${practicePhone}" style="color:#f06706">${practicePhone}</a><br />
                                                                        📧 ${i18n.t("orderMissingInsurance.email")} <a href="mailto:${practiceEmail}" style="color:#f06706">${practiceEmail}</a>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px;padding-left:10px;padding-right:10px">
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        <strong>${i18n.t("orderMissingInsurance.practiceName")}</strong><br />
                                                                        ${i18n.t("orderMissingInsurance.address")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:15px;padding-bottom:0;padding-left:10px;padding-right:10px">
                                                                    <p style="Margin:0 0 6px 0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderMissingInsurance.regards")}
                                                                    </p>
                                                                    <p style="Margin:0;mso-line-height-rule:exactly;font-family:arial,'helvetica neue',helvetica,sans-serif;line-height:22px;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderMissingInsurance.team")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="left" style="padding:0;Margin:0">
                                            ${getEmailFooter(i18n.t("orderMissingInsurance.footer", { year: currentYear }))}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
    `.trim();
  } catch (error) {
    console.error("Error generating missing insurance card email:", error);
    throw error;
  }
}

module.exports = {
  getOrderMissingInsuranceTemplate,
};

