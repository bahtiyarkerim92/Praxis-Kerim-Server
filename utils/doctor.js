const GENERAL_DOCTOR_NAME = "Allgemeiner Arzttermin";
const GENERAL_DOCTOR_NAME_LOWER = GENERAL_DOCTOR_NAME.toLowerCase();

function isGeneralDoctorName(name) {
  if (!name) return false;
  return name.trim().toLowerCase() === GENERAL_DOCTOR_NAME_LOWER;
}

function getLocalizedDoctorName(name, i18nInstance) {
  if (!name) {
    return "";
  }

  if (
    !i18nInstance ||
    typeof i18nInstance.t !== "function" ||
    !isGeneralDoctorName(name)
  ) {
    return name;
  }

  return i18nInstance.t("doctorNames.general");
}

module.exports = {
  GENERAL_DOCTOR_NAME,
  isGeneralDoctorName,
  getLocalizedDoctorName,
};

