const mongoose = require("mongoose");
const Doctor = require("./Doctor");

const BERLIN_TZ = "Europe/Berlin";

const berlinWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TZ,
  weekday: "short",
});

const berlinOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TZ,
  timeZoneName: "shortOffset",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const VIDEO_DOCTOR_NAMES = new Set(["M. Cem Samar"]);

function getBerlinOffsetMinutes(date) {
  const tzPart = berlinOffsetFormatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName");

  const match = tzPart?.value.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return 60; // Default to UTC+1
  }

  const sign = match[1].startsWith("-") ? -1 : 1;
  const hours = Math.abs(Number(match[1]));
  const minutes = match[2] ? Number(match[2]) : 0;

  return sign * (hours * 60 + minutes);
}

function convertBerlinSlotToUtc(date, slot) {
  if (!date || !slot) {
    return null;
  }

  const [hour, minute] = slot.split(":").map(Number);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const baseUtcMillis = Date.UTC(year, month, day, hour, minute);
  const baseDate = new Date(baseUtcMillis);
  const offsetMinutes = getBerlinOffsetMinutes(baseDate);

  return new Date(baseUtcMillis - offsetMinutes * 60000);
}

function isBerlinFriday(dateUtc) {
  if (!dateUtc) {
    return false;
  }
  return berlinWeekdayFormatter.format(dateUtc) === "Fri";
}

async function isVideoDoctor(doc) {
  try {
    if (!doc) {
      return false;
    }

    if (typeof doc.populated === "function" && doc.populated("doctorId")) {
      const populatedDoctor = doc.doctorId;
      return Boolean(
        populatedDoctor && VIDEO_DOCTOR_NAMES.has(populatedDoctor.name)
      );
    }

    if (
      doc.doctorId &&
      typeof doc.doctorId === "object" &&
      doc.doctorId !== null &&
      doc.doctorId.name
    ) {
      return VIDEO_DOCTOR_NAMES.has(doc.doctorId.name);
    }

    const doctorId =
      typeof doc.doctorId === "object" && doc.doctorId !== null
        ? doc.doctorId._id || doc.doctorId
        : doc.doctorId;

    if (doctorId) {
      const doctor = await Doctor.findById(doctorId).select("name").lean();
      if (doctor && VIDEO_DOCTOR_NAMES.has(doctor.name)) {
        return true;
      }
    }
  } catch (error) {
    console.error("Error determining video doctor:", error);
  }

  return false;
}

async function deriveIsVideoAppointment(doc) {
  if (!doc || !doc.date) {
    return false;
  }

  const canCheckModified = typeof doc.isModified === "function";
  const immutable =
    canCheckModified &&
    !doc.isModified("date") &&
    !doc.isModified("slot") &&
    !doc.isModified("doctorId");

  if (immutable && doc.isVideoAppointment === true) {
    return true;
  }

  if (await isVideoDoctor(doc)) {
    return true;
  }

  const appointmentDate = doc.date instanceof Date ? doc.date : new Date(doc.date);

  if (!doc.slot) {
    return isBerlinFriday(appointmentDate);
  }

  const appointmentDateTimeUtc = convertBerlinSlotToUtc(appointmentDate, doc.slot);
  return isBerlinFriday(appointmentDateTimeUtc);
}

const appointmentSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  slot: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format validation
  },
  patientEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Email format validation
  },
  patientName: {
    type: String,
    trim: true,
  },
  patientPhone: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["scheduled", "cancelled", "completed"],
    default: "scheduled",
  },
  title: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  isVideoAppointment: {
    type: Boolean,
    default: false,
  },
  locale: {
    type: String,
    default: "de",
    enum: ["de", "en", "bg", "pl", "tr"],
  },
  managementToken: {
    type: String,
    unique: true,
    sparse: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  cancelledAt: {
    type: Date,
  },
  cancelReason: {
    type: String,
    trim: true,
  },
  completedAt: {
    type: Date,
  },
});

// Create compound index for doctor, date, and slot to prevent double booking
appointmentSchema.index({ doctorId: 1, date: 1, slot: 1 }, { unique: true });

// Update the updatedAt field before saving
appointmentSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();

  // Set timestamp based on status change
  if (this.isModified("status")) {
    const now = Date.now();
    switch (this.status) {
      case "confirmed":
        this.confirmedAt = now;
        break;
      case "cancelled":
        this.cancelledAt = now;
        break;
      case "completed":
        this.completedAt = now;
        break;
    }
  }

  this.isVideoAppointment = await deriveIsVideoAppointment(this);

  next();
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
