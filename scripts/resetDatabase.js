require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Doctor = require("../models/Doctor");

async function resetDatabase() {
  try {
    // Check for confirmation argument
    const args = process.argv.slice(2);
    if (!args.includes("--confirm")) {
      console.log(
        "\n⚠️  WARNING: This will delete ALL data from the database!"
      );
      console.log("\n💡 To confirm, run: npm run reset:db -- --confirm");
      console.log("   Or: node scripts/resetDatabase.js --confirm\n");
      process.exit(0);
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.DB_CONNECTION_STRING);
    console.log("✅ Connected to MongoDB");

    // Drop the database
    console.log("\n🗑️  Dropping database...");
    await mongoose.connection.db.dropDatabase();
    console.log("✅ Database dropped successfully!");

    // Create the first doctor/admin user
    console.log("\n👤 Creating first Doctor/Admin user...");

    const hashedPassword = await bcrypt.hash("admin123!", 10);

    const firstDoctor = new Doctor({
      name: "Dr. Admin",
      email: "admin@telemedker.com",
      password: hashedPassword,
      specialties: ["Administration", "General Medicine"],
      plansOffered: ["consultation", "prescription"],
      bio: "System Administrator and Primary Doctor. Full access to all features including doctor and admin functionalities.",
      photoUrl: "",
      experience: 15,
      isActive: true,
      isAdmin: true, // Has admin privileges
      isDoctor: true, // Can perform doctor duties
    });

    await firstDoctor.save();

    console.log("\n✅ First Doctor/Admin created successfully!");
    console.log("\n📋 Login Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:    admin@telemedker.com");
    console.log("🔐 Password: admin123!");
    console.log("👨‍⚕️  Role:     Doctor + Admin");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✨ You can now:");
    console.log("  • Manage doctor accounts");
    console.log("  • Manage admin accounts");
    console.log("  • View analytics");
    console.log("  • Set availability");
    console.log("  • Manage appointments");
    console.log("  • See patients");
    console.log("  • Manage coupons");
    console.log("  • Access all features");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
    process.exit(0);
  }
}

resetDatabase();
