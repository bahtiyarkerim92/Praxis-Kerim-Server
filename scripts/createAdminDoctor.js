require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Doctor = require("../models/Doctor");

async function createAdminDoctor() {
  try {
    await mongoose.connect(process.env.DB_CONNECTION_STRING);
    console.log("Connected to MongoDB");

    // Check if admin doctor already exists
    const existingAdmin = await Doctor.findOne({ isAdmin: true });
    if (existingAdmin) {
      console.log("Admin doctor already exists:", existingAdmin.email);
      process.exit(0);
    }

    // Create admin doctor
    const hashedPassword = await bcrypt.hash("admin123!", 10);

    const adminDoctor = new Doctor({
      name: "Dr. Admin",
      email: "admin@telemedker.com",
      password: hashedPassword,
      specialties: ["Administration", "General Medicine"],
      plansOffered: ["consultation"],
      bio: "System administrator and general practitioner",
      photoUrl: "",
      experience: 10,
      isActive: true,
      isAdmin: true,
    });

    await adminDoctor.save();
    console.log("✅ Admin doctor created successfully!");
    console.log("📧 Email: admin@telemedker.com");
    console.log("🔐 Password: admin123!");
  } catch (error) {
    console.error("❌ Error creating admin doctor:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

createAdminDoctor();
