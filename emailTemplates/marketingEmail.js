require("dotenv").config();
const getEmailHead = require("./emailParts/head");
const { getEmailHeader } = require("./emailParts/header");
const { getEmailFooter } = require("./emailParts/footer");

/**
 * Marketing Email Template
 * @param {Object} params
 * @param {string} params.patientName - Patient's name
 * @param {string} params.content - Free text HTML content
 * @param {string} params.locale - Language locale (de, en, bg, pl, tr)
 * @returns {string} - Complete HTML email
 */
function getMarketingEmailTemplate({ patientName, content, locale = "de" }) {
  const emailHead = getEmailHead();
  const emailHeader = getEmailHeader();
  const emailFooter = getEmailFooter();

  // Greeting translations
  const greetings = {
    de: "Sehr geehrte/r",
    en: "Dear",
    bg: "Уважаеми",
    pl: "Szanowny/a",
    tr: "Sayın",
  };

  const greeting = greetings[locale] || greetings["de"];
  const fullGreeting = patientName
    ? `${greeting} ${patientName},`
    : `${greeting} Patient/in,`;

  return `
<!DOCTYPE html>
<html lang="${locale}">
${emailHead}
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); max-width: 600px;" class="email-container">
          ${emailHeader}
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
                    <p style="margin: 0 0 20px 0;">${fullGreeting}</p>
                    
                    <!-- Free Text Content -->
                    <div style="margin: 20px 0;">
                      ${content}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          ${emailFooter}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

module.exports = {
  getMarketingEmailTemplate,
};

