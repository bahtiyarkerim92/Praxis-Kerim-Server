require("dotenv").config();
const { getEmailFooter } = require("./emailParts/footer");
const getEmailHead = require("./emailParts/head");
const { getEmailHeader } = require("./emailParts/header");
const i18n = require("../config/i18n");

async function getOrderReadyTemplate(orderData, locale = "de") {
  try {
    // Set the language for this email
    await i18n.changeLanguage(locale);
    
    const currentYear = new Date().getFullYear();

    // Practice information
    const practicePhone = process.env.PRACTICE_PHONE || "+49 69 870015360";
    const practiceEmail = process.env.PRACTICE_EMAIL || "info@praxiskerim.de";
    const practiceWhatsapp = process.env.PRACTICE_WHATSAPP || "+49 69 870015360";

    return `
<!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="${locale}">

  ${getEmailHead(i18n.t("orderReadyEmail.subject"))}

<body class="body"
    style="width:100%;height:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
    <div dir="ltr" class="es-wrapper-color" lang="${locale}" style="background-color:#FAFAFA"><!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#fafafa"></v:fill>
			</v:background>
		<![endif]-->
        <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none"
            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top;background-color:#FAFAFA">
            <tr>
                <td valign="top" style="padding:0;Margin:0">
                    ${getEmailHeader()}
                     <div style="display:none; max-height:0; overflow:hidden; font-size:0; line-height:0; opacity:0;">
                       ${i18n.t("orderReadyEmail.previewText")}
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
                                                                        alt="Order Ready" height="100" class="img-5752"
                                                                        style="display:block;font-size:14px;border:0;outline:none;text-decoration:none"
                                                                        width="107"></td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" class="es-text-1802"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
                                                                    <h1 class="es-m-txt-c es-text-mobile-size-24 es-override-size"
                                                                        style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:38px;font-style:normal;font-weight:bold;line-height:46px;color:#333333">
                                                                        ${i18n.t("orderReadyEmail.title")}</h1>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    class="es-m-p0r es-m-p0l es-m-p10t es-m-p10b"
                                                                    style="Margin:0;padding-top:5px;padding-right:40px;padding-bottom:5px;padding-left:40px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderReadyEmail.greeting", { patientName: orderData.patientName || "" })}</p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <br>
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderReadyEmail.message")}</p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    class="es-m-p0r es-m-p0l es-m-p10t es-m-p10b"
                                                                    style="Margin:0;padding-top:15px;padding-right:40px;padding-bottom:5px;padding-left:40px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <strong>${i18n.t("orderReadyEmail.dependingOnType")}</strong>
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <br>
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:24px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        📝 ${i18n.t("orderReadyEmail.referralInfo")}</p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <br>
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:24px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        🏥 ${i18n.t("orderReadyEmail.auInfo")}</p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <br>
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:24px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        💊 ${i18n.t("orderReadyEmail.prescriptionInfo")}</p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    class="es-m-p0r es-m-p0l es-m-p10t es-m-p10b"
                                                                    style="Margin:0;padding-top:20px;padding-right:40px;padding-bottom:5px;padding-left:40px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <strong>📍 ${i18n.t("orderReadyEmail.pickupLocation")}</strong>
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <br>
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <strong>${i18n.t("orderReadyEmail.practiceName")}</strong><br>
                                                                        ${i18n.t("orderReadyEmail.address")}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" class="es-m-p10t es-m-p10b"
                                                                    style="padding:0;Margin:0;padding-top:20px;padding-bottom:20px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <strong>${i18n.t("orderReadyEmail.contactTitle")}</strong><br><br>
                                                                        📞 ${i18n.t("orderReadyEmail.phone")} <a href="tel:${practicePhone}" style="color:#f06706">${practicePhone}</a><br>
                                                                        📧 ${i18n.t("orderReadyEmail.email")} <a href="mailto:${practiceEmail}" style="color:#f06706">${practiceEmail}</a><br>
                                                                        💬 ${i18n.t("orderReadyEmail.whatsapp")} <a href="https://wa.me/${practiceWhatsapp.replace(/[^0-9]/g, "")}" style="color:#f06706">${practiceWhatsapp}</a>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    class="es-m-p0r es-m-p0l es-m-p10t es-m-p10b"
                                                                    style="Margin:0;padding-top:5px;padding-right:40px;padding-bottom:5px;padding-left:40px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t("orderReadyEmail.regards")}
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
                   ${getEmailFooter(i18n.t("orderReadyEmail.footer", { year: currentYear }))}
                </td>
            </tr>
        </table>
    </div>
</body>

</html>
`;
  } catch (error) {
    console.error("Error generating order ready template:", error);
    throw error;
  }
}

module.exports = { getOrderReadyTemplate };

