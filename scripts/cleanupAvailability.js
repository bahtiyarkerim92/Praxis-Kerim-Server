const mongoose = require("mongoose");
const Availability = require("../models/Availability");
const Doctor = require("../models/Doctor");

require("dotenv").config();

async function cleanupAvailability() {
  try {
    console.log("🧹 Starting availability cleanup...");

    // Connect to database
    await mongoose.connect(process.env.DB_CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to database");

    // Find all availability records
    const availabilityRecords = await Availability.find({});
    console.log(`📋 Found ${availabilityRecords.length} availability records`);

    let removedCount = 0;
    let validCount = 0;

    for (const record of availabilityRecords) {
      try {
        // Check if the referenced doctor exists
        const doctor = await Doctor.findById(record.doctorId);

        if (!doctor) {
          console.log(
            `❌ Removing availability record with invalid doctor ID: ${record.doctorId}`
          );
          await Availability.findByIdAndDelete(record._id);
          removedCount++;
        } else {
          validCount++;
        }
      } catch (error) {
        console.log(`❌ Error checking record ${record._id}: ${error.message}`);
        await Availability.findByIdAndDelete(record._id);
        removedCount++;
      }
    }

    console.log("\n🎉 Cleanup completed!");
    console.log(`✅ Valid records: ${validCount}`);
    console.log(`🗑️  Removed records: ${removedCount}`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from database");
    process.exit(0);
  }
}

// Run the cleanup
cleanupAvailability();
