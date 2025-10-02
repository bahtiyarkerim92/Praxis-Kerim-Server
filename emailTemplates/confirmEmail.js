const i18n = require("i18next");
require("dotenv").config();
const { getEmailFooter } = require("./emailParts/footer");
const getEmailHead = require("./emailParts/head");
const { getEmailHeader } = require("./emailParts/header");
async function getConfirmEmailTemplate(validationUrl, locale) {
  try {
    await i18n.changeLanguage(locale);
    const currentYear = new Date().getFullYear();
    return `
<!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

  ${getEmailHead(i18n.t("email.confirmEmail.title"))}

<body class="body"
    style="width:100%;height:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
    <div dir="ltr" class="es-wrapper-color" lang="en" style="background-color:#FAFAFA"><!--[if gte mso 9]>
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
   ${i18n.t("email.confirmEmail.message")}
</div>
                    <table cellpadding="0" cellspacing="0" align="center" class="es-content" role="none"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important">
                        <tr>
                            <td align="center" style="padding:0;Margin:0">
                                <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0"
                                    class="es-content-body" role="none"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;width:600px">
                                    <tr>
                                        <td align="left" class="es-m-p15t"
                                            style="Margin:0;padding-right:20px;padding-left:20px;padding-top:30px;padding-bottom:30px">
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
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px;font-size:0px">
                                                                    <img src="https://images-pickup2.s3.eu-north-1.amazonaws.com/confrim-email.png"
                                                                        alt="" height="100" class="img-5752"
                                                                        style="display:block;font-size:14px;border:0;outline:none;text-decoration:none"
                                                                        width="107"></td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" class="es-text-1802"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
                                                                    <h1 class="es-m-txt-c es-text-mobile-size-24 es-override-size"
                                                                        style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:38px;font-style:normal;font-weight:bold;line-height:46px;color:#333333">
                                                                        ${i18n.t(
                                                                          "email.confirmEmail.title"
                                                                        )}</h1>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    class="es-m-p0r es-m-p0l es-m-p10t es-m-p10b"
                                                                    style="Margin:0;padding-top:5px;padding-right:40px;padding-bottom:5px;padding-left:40px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.confirmEmail.greeting"
                                                                        )}</p>
                                                                        <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.confirmEmail.message"
                                                                        )}</p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.confirmEmail.description"
                                                                        )}
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        <strong><br></strong></p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" class="es-m-p10t es-m-p10b"
                                                                    style="padding:0;Margin:0;padding-top:20px;padding-bottom:20px">
                                                                    <span class="es-button-border"
                                                                        style="border-style:solid;border-color:#2CB543;background:#f06706;border-width:0px;display:inline-block;border-radius:8px;width:auto"><a
                                                                            href="${validationUrl}"
                                                                            class="es-button"
                                                                            style="mso-style-priority:100 !important;text-decoration:none !important;mso-line-height-rule:exactly;color:#FFFFFF;font-size:20px;padding:10px 30px 10px 30px;display:inline-block;background:#f06706;border-radius:8px;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-weight:normal;font-style:normal;line-height:24px;width:auto;text-align:center;letter-spacing:0;mso-padding-alt:0;mso-border-alt:10px solid #f06706;padding-left:30px;padding-right:30px">${i18n.t(
                                                                              "email.confirmEmail.buttonText"
                                                                            )}</a></span></td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    class="es-m-p0r es-m-p0l es-m-p10t es-m-p10b"
                                                                    style="Margin:0;padding-top:5px;padding-right:40px;padding-bottom:5px;padding-left:40px">
                                                                   
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.confirmEmail.closing"
                                                                        )}
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.emailFooter.regards"
                                                                        )}<br>   ${i18n.t(
                                                                          "email.emailFooter.team"
                                                                        )}</p>
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
                   ${getEmailFooter(currentYear)}
                </td>
            </tr>
        </table>
    </div>
</body>

</html>
    `;
  } catch (error) {
    console.error("Error generating email template:", error);
    throw error;
  }
}

module.exports = { getConfirmEmailTemplate };
