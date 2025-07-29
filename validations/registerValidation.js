const { check, validationResult } = require("express-validator");
const {
  krankenkassen,
  private_krankenkassen,
} = require("../utils/krankenkassen");

const validateRegisterRequest = [
  // First Name Validation
  check("firstName")
    .trim()
    .not()
    .isEmpty()
    .withMessage("First name is required"),

  // Last Name Validation
  check("lastName").trim().not().isEmpty().withMessage("Last name is required"),

  // Gender Validation
  check("gender")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Gender is required")
    .isIn(["male", "female", "other"])
    .withMessage("Gender must be either 'male', 'female', or 'other'"),

  // Birth Date Validation
  check("birthDate")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Birth date is required")
    .custom((value) => {
      const date = new Date(value);
      const minDate = new Date("1900-01-01");
      const today = new Date();

      if (date < minDate || date > today) {
        throw new Error("Birthday must be between 1900-01-01 and today");
      }
      return true;
    }),

  // Address Validation
  check("address")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Street name is required"),

  check("addressNumber")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Address number is required"),

  check("postCode").trim().not().isEmpty().withMessage("Post code is required"),

  check("city").trim().not().isEmpty().withMessage("City is required"),

  // Country Validation

  // Email Validation
  check("email")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  // Password Validation
  check("password")
    .trim()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  // Terms Accepted Validation

  // Bulgarian-specific validations
  check("nationalIdNumber")
    .if(check("country").equals("BG"))
    .trim()
    .matches(/^\d{10}$/)
    .withMessage("Valid EGN is required for Bulgarian citizens"),

  // German-specific validations
  check("insurance.type")
    .if(check("country").equals("DE"))
    .trim()
    .isIn(["state", "private"])
    .withMessage(
      "For German users, insurance type must be either 'state' or 'private'"
    ),

  check("insurance.company")
    .if(check("country").equals("DE"))
    .trim()
    .custom((value, { req }) => {
      if (req.body.country !== "DE") return true;

      const validCompanies =
        req.body.insurance?.type === "state"
          ? krankenkassen
          : private_krankenkassen;

      if (!validCompanies.includes(value)) {
        throw new Error(
          "Invalid insurance company for the selected insurance type"
        );
      }
      return true;
    }),

  check("insurance.number")
    .if(check("country").equals("DE"))
    .trim()
    .not()
    .isEmpty()
    .withMessage("Insurance number is required for German users"),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation error",
      errors: errors.array().map((err) => err.msg),
    });
  }
  next();
};

module.exports = {
  validateRegisterRequest,
  handleValidation,
};
