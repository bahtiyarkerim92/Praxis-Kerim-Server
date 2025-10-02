const i18n = require("i18next");
require("dotenv").config();
const { getEmailFooter } = require("./emailParts/footer");
const { getEmailHeader } = require("./emailParts/header");
const getEmailHead = require("./emailParts/head");
async function getResetPasswordTemplate(resetUrl, locale, companyName) {
  console.log("emailTemplate", locale);
  try {
    await i18n.changeLanguage(locale);
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

${getEmailHead(i18n.t("email.passwordReset.title"))}

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
   ${i18n.t("email.passwordReset.message")}
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
                                            style="padding:0;Margin:0;padding-top:15px;padding-right:20px;padding-left:20px">
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
                                                                    style="padding:0;Margin:0;padding-top:20px;padding-bottom:20px;font-size:0px">
                                                                    <img src="https://images-pickup2.s3.eu-north-1.amazonaws.com/reset-password.png"
                                                                        alt="" width="100"
                                                                        style="display:block;font-size:14px;border:0;outline:none;text-decoration:none"
                                                                        height="100"></td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center"
                                                                    class="es-m-p0r es-m-p0l es-text-9743"
                                                                    style="Margin:0;padding-top:10px;padding-bottom:10px;padding-right:40px;padding-left:40px">
                                                                    <h1 class="es-m-txt-c es-override-size es-text-mobile-size-22"
                                                                        style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:46px;font-style:normal;font-weight:bold;line-height:55.2px;color:#333333">
                                                                        <span
                                                                            style="font-size:36px;line-height:54px">  ${i18n.t(
                                                                              "email.passwordReset.title"
                                                                            )}</span>&nbsp;</h1>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px;text-align:center">
                                                                        ${i18n.t(
                                                                          "email.passwordReset.greeting",
                                                                          {
                                                                            companyName:
                                                                              companyName,
                                                                          }
                                                                        )}</p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px;text-align:center">
                                                                        ${i18n.t(
                                                                          "email.passwordReset.message"
                                                                        )}</p>
                                                                    <ol
                                                                        style="font-family:arial, 'helvetica neue', helvetica, sans-serif;padding:0px 0px 0px 40px;margin-top:15px;margin-bottom:15px">
                                                                    </ol>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="left"
                                            style="padding:0;Margin:0;padding-right:20px;padding-left:20px;padding-bottom:20px">
                                            <table cellpadding="0" cellspacing="0" width="100%" role="none"
                                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                <tr>
                                                    <td align="center" valign="top"
                                                        style="padding:0;Margin:0;width:560px">
                                                        <table cellpadding="0" cellspacing="0" width="100%"
                                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:separate;border-spacing:0px;border-radius:5px"
                                                            role="presentation">
                                                            <tr>
                                                                <td align="center" class="es-m-p0t"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
                                                                    <span class="es-button-border"
                                                                        style="border-style:solid;border-color:#2CB543;background:#5C68E2;border-width:0px;display:inline-block;border-radius:6px;width:auto"><a
                                                                            href="${resetUrl}"
                                                                            class="es-button es-button-3232"
                                                                            style="mso-style-priority:100 !important;text-decoration:none !important;mso-line-height-rule:exactly;color:#FFFFFF;font-size:20px;padding:10px 30px 10px 30px;display:inline-block;background:#5C68E2;border-radius:6px;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-weight:normal;font-style:normal;line-height:24px;width:auto;text-align:center;letter-spacing:0;mso-padding-alt:0;mso-border-alt:10px solid #5C68E2;border-left-width:30px;border-right-width:30px">${i18n.t(
                                                                              "email.passwordReset.buttonText"
                                                                            )}</a></span></td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" class="es-text-7081"
                                                                    style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:27px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.passwordReset.expiryMessage"
                                                                        )}</p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.passwordReset.supportMessage"
                                                                        )}
                                                                    </p>
                                                                    <p
                                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">
                                                                        ${i18n.t(
                                                                          "email.passwordReset.regards"
                                                                        )},<br>${i18n.t(
                                                                          "email.passwordReset.team"
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

module.exports = { getResetPasswordTemplate };
