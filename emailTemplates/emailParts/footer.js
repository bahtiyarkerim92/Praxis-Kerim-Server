// Simple footer for all Praxis Kerim emails
// Works for both multilingual and non-multilingual emails
function getEmailFooter(copyrightText) {
  const currentYear = new Date().getFullYear();
  const footerText = copyrightText || `© ${currentYear} Praxis Dr. Kerim. Alle Rechte vorbehalten.`;
  
  return `
    <table cellpadding="0" cellspacing="0" align="center" class="es-footer" role="none"
        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important;background-color:transparent;background-repeat:repeat;background-position:center top">
        <tr>
            <td align="center" style="padding:0;Margin:0">
                <table align="center" cellpadding="0" cellspacing="0" class="es-footer-body"
                    role="none"
                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:transparent;width:640px">
                    <tr>
                        <td align="left"
                            style="Margin:0;padding-right:20px;padding-left:20px;padding-bottom:20px;padding-top:20px">
                            <table cellpadding="0" cellspacing="0" width="100%" role="none"
                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                <tr>
                                    <td align="left" style="padding:0;Margin:0;width:600px">
                                        <table cellpadding="0" cellspacing="0" width="100%"
                                            role="presentation"
                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                            <tr>
                                                <td align="center"
                                                    style="padding:0;Margin:0;padding-bottom:20px">
                                                    <p
                                                        style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:18px !important;letter-spacing:0;color:#333333;font-size:12px">
                                                        ${footerText}</p>
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
  `;
}

module.exports = { getEmailFooter };
