const { query } = require("express-validator");
const { handleValidation } = require("../utils/validation");

const validateEmailValidationRequest = [
  query("token")
    .trim()
    .not()
    .isEmpty()
    .withMessage("login.emailValidation.validation.token.missing")
    .isJWT()
    .withMessage("login.emailValidation.validation.token.invalid"),
];

const handleEmailValidation = (req, res, next) => {
  handleValidation(req, res, next);
};

module.exports = { validateEmailValidationRequest, handleEmailValidation };
