const { check } = require("express-validator");
const { handleValidation } = require("../utils/validation");

const validateResetPasswordRequest = [
  check("token")
    .trim()
    .not()
    .isEmpty()
    .withMessage("resetPasswordValidation.TOKEN_REQUIRED")
    .isString()
    .withMessage("resetPasswordValidation.TOKEN_MUST_BE_STRING"),
  check("newPassword")
    .trim()
    .not()
    .isEmpty()
    .withMessage("resetPasswordValidation.NEW_PASSWORD_REQUIRED")
    .isLength({ min: 8 })
    .withMessage("resetPasswordValidation.PASSWORD_TOO_SHORT")
    .matches(/[a-z]/)
    .withMessage("resetPasswordValidation.PASSWORD_MISSING_LOWERCASE")
    .matches(/[A-Z]/)
    .withMessage("resetPasswordValidation.PASSWORD_MISSING_UPPERCASE")
    .matches(/[0-9]/)
    .withMessage("resetPasswordValidation.PASSWORD_MISSING_NUMBER")
    .matches(/[^a-zA-Z0-9]/)
    .withMessage("resetPasswordValidation.PASSWORD_MISSING_SPECIAL"),
  check("repeatPassword")
    .trim()
    .not()
    .isEmpty()
    .withMessage("resetPasswordValidation.REPEAT_PASSWORD_REQUIRED")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("resetPasswordValidation.PASSWORDS_DO_NOT_MATCH");
      }
      return true;
    }),
];

const handleResetPasswordRequest = (req, res, next) => {
  handleValidation(req, res, next);
};

module.exports = {
  validateResetPasswordRequest,
  handleResetPasswordRequest,
};
