require("dotenv").config();
const getEmailHead = require("./emailParts/head");
const { getEmailHeader } = require("./emailParts/header");
const { getEmailFooter } = require("./emailParts/footer");

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatContent(content = "") {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const isLikelyHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  if (isLikelyHtml) {
    return trimmed;
  }

  return trimmed
    .split(/\r?\n\r?\n/)
    .map((paragraph) => {
      const safeParagraph = escapeHtml(paragraph.trim())
        .replace(/\r?\n/g, "<br />");
      return safeParagraph
        ? `<p style="margin: 0 0 16px 0;">${safeParagraph}</p>`
        : "";
    })
    .join("");
}

function getMarketingEmailTemplate({
  patientName,
  content,
  locale = "de",
  i18n,
}) {
  const emailHead = getEmailHead();
  const emailHeader = getEmailHeader();
  const footerCopy =
    i18n?.t("marketingEmail.footer", {
      year: new Date().getFullYear(),
    }) || undefined;
  const emailFooter = getEmailFooter(footerCopy);

  const greetingWithName =
    i18n?.t("marketingEmail.greetingWithName", { name: patientName }) ||
    (patientName ? `Sehr geehrte/r ${patientName},` : null);
  const greetingWithoutName =
    i18n?.t("marketingEmail.greetingWithoutName") ||
    "Sehr geehrte Patientin, sehr geehrter Patient,";

  const greeting = patientName ? greetingWithName : greetingWithoutName;

  const heroTitle =
    i18n?.t("marketingEmail.title") || "Neuigkeiten aus Ihrer Praxis";
  const heroSubtitle = i18n?.t("marketingEmail.subtitle") || "";

  const closing =
    i18n?.t("marketingEmail.closing") || "Mit freundlichen Grüßen";
  const signature =
    i18n?.t("marketingEmail.signature") || "Ihr Praxis Dr. Kerim Team";
  const formattedContent = formatContent(content);

  return `
<!DOCTYPE html>
<html lang="${locale}">
${emailHead}
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.08); max-width: 600px;" class="email-container">
          ${emailHeader}
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #EEC16B 0%, #D4A857 100%); border-radius: 12px 12px 0 0;">
                <tr>
                  <td style="padding: 40px 40px 32px 40px; text-align: left;">
                    <p style="margin: 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: rgba(0,0,0,0.6); font-weight: 600;">
                      Praxis Dr. Kerim
                    </p>
                    <h1 style="margin: 12px 0 8px 0; font-size: 28px; line-height: 1.25; color: #101828; font-weight: 700;">
                      ${heroTitle}
                    </h1>
                    ${
                      heroSubtitle
                        ? `<p style="margin: 0; font-size: 16px; color: rgba(16, 24, 40, 0.8); line-height: 1.5;">${heroSubtitle}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 48px 40px; color: #1d2939;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size: 16px; line-height: 1.6;">
                    ${
                      greeting
                        ? `<p style="margin: 0 0 24px 0; font-weight: 600; color: #101828;">${greeting}</p>`
                        : ""
                    }
                    <div style="margin: 0 0 32px 0;">
                      ${formattedContent}
                    </div>
                    <p style="margin: 0 0 4px 0; font-weight: 600;">${closing}</p>
                    <p style="margin: 0; color: #475467;">${signature}</p>
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

