const i18n = require("i18next");
require("dotenv").config();

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
                                            <!-- Logo removed -->
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
  `;
}

module.exports = { getEmailHeader };
