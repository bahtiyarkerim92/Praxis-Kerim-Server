const { check } = require("express-validator");
const { handleValidation } = require("../utils/validation");

const validateLoginRequest = [
  check("email")
    .trim()
    .isEmail()
    .withMessage("login.emailValidation.validation.email.invalid"),
  check("password")
    .trim()
    .not()
    .isEmpty()
    .withMessage("login.emailValidation.validation.password.required"),
];

const handleLoginValidation = (req, res, next) => {
  handleValidation(req, res, next);
};

module.exports = { validateLoginRequest, handleLoginValidation };
