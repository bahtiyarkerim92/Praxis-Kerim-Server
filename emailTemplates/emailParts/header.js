const i18n = require("i18next");

function getEmailHeader() {
  return `
    <table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important">
                        <tr>
                            <td align="center" bgcolor="transparent" style="padding:0;Margin:0">
                                <table cellpadding="0" cellspacing="0" bgcolor="#ffffff" align="center"
                                    class="es-content-body" role="none"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;width:600px">
                                    <tr>
                                        <td align="left" style="padding:20px;Margin:0">
                                            <table width="100%" cellpadding="0" cellspacing="0" role="none"
                                                style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                <tr>
                                                    <td align="left" style="padding:0;Margin:0;width:560px">
                                                        <table cellpadding="0" cellspacing="0" width="100%"
                                                            role="presentation"
                                                            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px">
                                                            <tr>
                                                                <td align="left" style="padding:0;Margin:0;font-size:0">
                                                                    <img src="https://firebasestorage.googleapis.com/v0/b/space4time-2e4fa.firebasestorage.app/o/images%2Flogo_telemediker.png?alt=media&token=58fa76fe-5381-440e-befa-9b3c7bb3902e"
                                                                        alt="" width="150" class="img-6461" height="60"
                                                                        style="display:block;font-size:14px;border:0;outline:none;text-decoration:none">
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

module.exports = { getEmailHeader };
