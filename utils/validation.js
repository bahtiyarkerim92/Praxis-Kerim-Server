const { validationResult } = require("express-validator");
const i18n = require("i18next");

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  const locale = req.headers["accept-language"] || "en";

  if (!errors.isEmpty()) {
    const translatedErrors = {};
    errors.array().forEach((error) => {
      translatedErrors[error.param] =
        i18n.t(`registrationValidation.${error.msg}`, { lng: locale }) ||
        error.msg;
    });

    return res.status(400).json({
      error: {
        message: "Validation failed",
        errors: translatedErrors,
      },
    });
  }
  next();
};

module.exports = { handleValidation };
