const mongoose = require("mongoose");
const Availability = require("../models/Availability");

require("dotenv").config();

async function fixAvailabilityIndex() {
  try {
    console.log("🔧 Starting availability index fix...");

    // Connect to database
    await mongoose.connect(process.env.DB_CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to database");

    // Get the collection
    const collection = mongoose.connection.db.collection("availabilities");

    // List current indexes
    console.log("📋 Current indexes:");
    const indexes = await collection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${JSON.stringify(index.key)} (${index.name})`);
    });

    // Drop the old index if it exists
    try {
      console.log("\n🗑️  Dropping old 'doctor_1_date_1' index...");
      await collection.dropIndex("doctor_1_date_1");
      console.log("✅ Old index dropped successfully");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log("ℹ️  Old index not found (already dropped)");
      } else {
        console.log(`⚠️  Error dropping index: ${error.message}`);
      }
    }

    // Remove all records with null or invalid doctor references
    console.log("\n🧹 Cleaning up invalid availability records...");

    const deleteResult = await collection.deleteMany({
      $or: [
        { doctor: null },
        { doctor: { $exists: true } },
        { doctorId: null },
        { doctorId: { $exists: false } },
      ],
    });

    console.log(`🗑️  Removed ${deleteResult.deletedCount} invalid records`);

    // Create new index with doctorId
    console.log("\n📝 Creating new index with doctorId...");
    await collection.createIndex({ doctorId: 1, date: 1 }, { unique: true });
    console.log("✅ New index created successfully");

    // Verify the new index
    console.log("\n📋 Updated indexes:");
    const newIndexes = await collection.indexes();
    newIndexes.forEach((index) => {
      console.log(`  - ${JSON.stringify(index.key)} (${index.name})`);
    });

    console.log("\n🎉 Index fix completed successfully!");
  } catch (error) {
    console.error("❌ Error fixing index:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from database");
    process.exit(0);
  }
}

// Run the fix
fixAvailabilityIndex();
