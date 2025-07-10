const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    // Patient reference
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Doctor reference
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    // Prescription details
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    medications: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        dosage: {
          type: String,
          required: true,
          trim: true,
        },
        frequency: {
          type: String,
          required: true,
          trim: true,
        },
        duration: {
          type: String,
          required: true,
          trim: true,
        },
        instructions: {
          type: String,
          trim: true,
        },
      },
    ],

    // General instructions
    generalInstructions: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Free prescription
    isFreePresc: {
      type: Boolean,
      default: false,
    },

    freePrescriptionNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Prescription dates
    prescriptionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    validUntil: {
      type: Date,
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "completed"],
      default: "active",
    },

    // File information
    pdfUrl: {
      type: String,
      required: true,
    },

    pdfKey: {
      type: String,
      required: true,
    },

    originalFileName: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    // Additional fields
    diagnosis: {
      type: String,
      trim: true,
    },

    // Multiple diagnoses support
    diagnoses: [
      {
        type: String,
        trim: true,
      },
    ],

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Follow-up information
    followUp: {
      required: {
        type: Boolean,
        default: false,
      },
      date: {
        type: Date,
      },
      notes: {
        type: String,
        trim: true,
      },
    },

    // Pharmacy information (optional)
    pharmacy: {
      name: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });
prescriptionSchema.index({ status: 1 });
prescriptionSchema.index({ prescriptionDate: 1 });
prescriptionSchema.index({ validUntil: 1 });

// Virtual for checking if prescription is expired
prescriptionSchema.virtual("isExpired").get(function () {
  return this.validUntil < new Date();
});

// Update status based on validity
prescriptionSchema.pre("save", function (next) {
  if (this.validUntil < new Date() && this.status === "active") {
    this.status = "expired";
  }
  next();
});

// Static method to find active prescriptions for a patient
prescriptionSchema.statics.findActiveForPatient = function (patientId) {
  return this.find({
    patientId,
    status: "active",
    validUntil: { $gte: new Date() },
  }).populate("doctorId", "name email specialties");
};

// Static method to find all prescriptions for a patient
prescriptionSchema.statics.findAllForPatient = function (patientId) {
  return this.find({ patientId })
    .populate("doctorId", "name email specialties")
    .sort({ createdAt: -1 });
};

// Static method to find prescriptions by doctor
prescriptionSchema.statics.findByDoctor = function (doctorId, options = {}) {
  const query = { doctorId };

  if (options.patientId) {
    query.patientId = options.patientId;
  }

  if (options.status) {
    query.status = options.status;
  }

  return this.find(query)
    .populate("patientId", "firstName lastName email")
    .sort({ createdAt: -1 });
};

// Instance method to check if prescription can be modified
prescriptionSchema.methods.canBeModified = function () {
  return this.status === "active" && this.validUntil > new Date();
};

// Instance method to get medication summary
prescriptionSchema.methods.getMedicationSummary = function () {
  return this.medications
    .map((med) => `${med.name} (${med.dosage})`)
    .join(", ");
};

module.exports = mongoose.model("Prescription", prescriptionSchema);
