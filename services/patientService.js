const Patient = require("../models/Patient");

/**
 * Create or update a patient record
 * @param {Object} patientData - Patient information (name, email, phone)
 * @returns {Promise<Object>} - Patient document
 */
async function createOrUpdatePatient(patientData) {
  try {
    const { name, email, phone } = patientData;

    if (!email) {
      console.warn("⚠️ Cannot save patient: email is required");
      return null;
    }

    // Check if patient exists
    let patient = await Patient.findOne({ email });

    if (patient) {
      // Update existing patient - don't save again if email exists
      console.log(`📝 Patient already exists: ${email} - skipping`);
      return patient;
    } else {
      // Create new patient
      console.log(`✨ Creating new patient: ${email}`);
      
      patient = new Patient({
        name: name || "N/A",
        email,
        phone: phone || "N/A",
      });

      await patient.save();
      console.log(`✅ New patient created: ${email}`);
    }

    return patient;
  } catch (error) {
    console.error("❌ Error in createOrUpdatePatient:", error);
    // Don't throw - we don't want to break appointment/order creation if patient save fails
    return null;
  }
}

module.exports = {
  createOrUpdatePatient,
};

