require("dotenv").config();
const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");

async function migrateDoctorPlans() {
  try {
    await mongoose.connect(
      process.env.DB_CONNECTION_STRING || "mongodb://localhost:27017/telemedker"
    );
    console.log("Connected to MongoDB");

    // Find all doctors
    const doctors = await Doctor.find({});
    console.log(`Found ${doctors.length} doctors to migrate`);

    for (const doctor of doctors) {
      let needsUpdate = false;
      const newPlans = [...doctor.plansOffered];

      // Replace old plan names with new ones - now only consultation is supported
      const planMapping = {
        basic: "consultation",
        standard: "consultation",
        premium: "consultation",
        prescriptions: "consultation",
        "follow-up": "consultation",
      };

      for (let i = 0; i < newPlans.length; i++) {
        if (planMapping[newPlans[i]] || newPlans[i] !== "consultation") {
          newPlans[i] = "consultation";
          needsUpdate = true;
        }
      }

      // Remove duplicates and ensure we have valid plans - only consultation is valid now
      const uniquePlans = [...new Set(newPlans)];
      const validPlans = uniquePlans.filter((plan) =>
        ["consultation"].includes(plan)
      );

      // If no valid plans, default to consultation
      if (validPlans.length === 0) {
        validPlans.push("consultation");
        needsUpdate = true;
      }

      if (needsUpdate || validPlans.length !== doctor.plansOffered.length) {
        await Doctor.findByIdAndUpdate(doctor._id, {
          plansOffered: validPlans,
        });
        console.log(
          `✅ Updated ${doctor.name} (${doctor.email}) plans: ${doctor.plansOffered} → ${validPlans}`
        );
      } else {
        console.log(
          `⏭️  ${doctor.name} (${doctor.email}) already has valid plans: ${doctor.plansOffered}`
        );
      }
    }

    console.log("✅ Migration completed!");
  } catch (error) {
    console.error("❌ Migration error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

migrateDoctorPlans();
