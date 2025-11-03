const i18next = require("i18next");
const Backend = require("i18next-fs-backend");
const path = require("path");

i18next.use(Backend).init({
  lng: "de", // Default language
  fallbackLng: "de",
  preload: ["de", "en", "bg", "pl", "tr"], // Preload all supported languages
  ns: ["translation"],
  defaultNS: "translation",
  backend: {
    loadPath: path.join(__dirname, "../locales/{{lng}}.json"),
  },
  interpolation: {
    escapeValue: false, // Not needed for server-side
  },
  returnNull: false,
  returnEmptyString: false,
});

module.exports = i18next;

