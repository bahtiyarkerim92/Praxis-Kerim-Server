require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");

async function createAdmin() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DB_CONNECTION_STRING);
    console.log("Connected to database");

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({});
    if (existingAdmin) {
      console.log("Admin already exists:");
      console.log("Email:", existingAdmin.email);
      console.log("\nUse this admin account to login.");
      process.exit(0);
    }

    // Create admin
    const email = process.env.ADMIN_EMAIL || "admin@telemedker.com";
    const password = process.env.ADMIN_PASSWORD || "Admin123!";
    const name = process.env.ADMIN_NAME || "Admin";

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    await admin.save();

    console.log("\n✅ Admin created successfully!");
    console.log("\nAdmin credentials:");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("\n⚠️  Please change the password after first login!");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();
