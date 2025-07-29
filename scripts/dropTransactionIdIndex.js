const mongoose = require("mongoose");
require("dotenv").config();

async function dropProblematicIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/test"
    );
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("payments");

    // List all indexes first
    console.log("📋 Current indexes on payments collection:");
    const indexes = await collection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${JSON.stringify(index.key)} (name: ${index.name})`);
    });

    // Try to drop the problematic transactionId_1 index
    try {
      await collection.dropIndex("transactionId_1");
      console.log("✅ Successfully dropped transactionId_1 index");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log("ℹ️ transactionId_1 index not found");
      } else {
        console.log("❌ Error dropping index:", error.message);
      }
    }

    // Try dropping by key pattern as well
    try {
      await collection.dropIndex({ transactionId: 1 });
      console.log("✅ Successfully dropped transactionId index by key pattern");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log("ℹ️ transactionId index by key pattern not found");
      } else {
        console.log("❌ Error dropping index by pattern:", error.message);
      }
    }

    // Show indexes after cleanup
    console.log("📋 Indexes after cleanup:");
    const indexesAfter = await collection.indexes();
    indexesAfter.forEach((index) => {
      console.log(`  - ${JSON.stringify(index.key)} (name: ${index.name})`);
    });

    // Also clean up any problematic payment records
    const result = await collection.deleteMany({ transactionId: null });
    console.log(
      `🗑️ Deleted ${result.deletedCount} payment records with transactionId: null`
    );

    console.log("✅ Index cleanup completed!");
  } catch (error) {
    console.error("❌ Script failed:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

dropProblematicIndex();
