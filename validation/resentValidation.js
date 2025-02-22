const { check } = require("express-validator");
const { handleValidation } = require("../utils/validation");

const validateResendValidationEmailRequest = [
  check("email")
    .trim()
    .not()
    .isEmpty()
    .withMessage("login.emailValidation.validation.email.required")
    .isEmail()
    .withMessage("login.emailValidation.validation.email.invalid"),
];

const handleResendValidationEmail = (req, res, next) => {
  handleValidation(req, res, next);
};

module.exports = {
  validateResendValidationEmailRequest,
  handleResendValidationEmail,
};
