const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");

require("dotenv").config();

const connectToDatabase = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/telemedker",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const createTestUser = async () => {
  try {
    const testEmail = "admin@telemedker.com";

    // Check if user already exists
    const existingUser = await User.findOne({ email: testEmail });
    if (existingUser) {
      console.log("✅ Test user already exists:", testEmail);
      console.log("You can login with:");
      console.log("Email:", testEmail);
      console.log("Password: admin123");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create test user
    const testUser = new User({
      firstName: "Admin",
      lastName: "User",
      gender: "other",
      birthday: new Date("1990-01-01"),
      address: {
        street: "Test Street",
        number: "123",
        postCode: "12345",
        city: "Berlin",
        country: {
          code: "DE",
          name: "Germany",
        },
      },
      email: testEmail,
      password: hashedPassword,
      termsAccepted: true,
      isEmailValidated: true, // Pre-validate for testing
      isAdmin: true, // Make admin for full access
      registrationDate: new Date(),
    });

    await testUser.save();

    console.log("✅ Test user created successfully!");
    console.log("Login credentials:");
    console.log("Email:", testEmail);
    console.log("Password: admin123");
    console.log("Admin: true");
  } catch (error) {
    console.error("❌ Error creating test user:", error);
  }
};

const run = async () => {
  await connectToDatabase();
  await createTestUser();
  await mongoose.connection.close();
  console.log("Database connection closed");
};

run().catch(console.error);
