const express = require("express");
const router = express.Router();
const {
  authenticateDoctorToken,
  requireDoctorRole,
} = require("../middleware/doctorAuth");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Rating = require("../models/Rating");

// GET /api/analytics/dashboard - Get dashboard analytics
router.get("/dashboard", authenticateDoctorToken, async (req, res) => {
  try {
    const doctorId = req.doctor._id;
    const isDoctor = req.doctor.isDoctor;
    const isAdmin = req.doctor.isAdmin;

    // Get current date ranges
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    let metrics = {};
    let recentPatients = [];
    let recentAppointments = [];

    if (isDoctor) {
      // Doctor-specific analytics
      const doctorFilter = { doctorId };

      // Get all appointments for this doctor
      const allAppointments = await Appointment.find(doctorFilter).populate(
        "patientId",
        "firstName lastName email birthday city"
      );

      // Get unique patients
      const uniquePatientIds = new Set();
      allAppointments.forEach((apt) => {
        if (apt.patientId && apt.patientId._id) {
          uniquePatientIds.add(apt.patientId._id.toString());
        }
      });

      // Get this month's and last month's patient counts
      const thisMonthAppointments = await Appointment.find({
        ...doctorFilter,
        createdAt: { $gte: thisMonthStart },
      });
      const lastMonthAppointments = await Appointment.find({
        ...doctorFilter,
        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
      });

      const thisMonthPatients = new Set();
      thisMonthAppointments.forEach((apt) => {
        if (apt.patientId) {
          thisMonthPatients.add(apt.patientId.toString());
        }
      });

      const lastMonthPatients = new Set();
      lastMonthAppointments.forEach((apt) => {
        if (apt.patientId) {
          lastMonthPatients.add(apt.patientId.toString());
        }
      });

      // Calculate patient growth
      const patientGrowth =
        lastMonthPatients.size > 0
          ? Math.round(
              ((thisMonthPatients.size - lastMonthPatients.size) /
                lastMonthPatients.size) *
                100
            )
          : 0;

      // Active patients (had appointment in last 30 days)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentAppointmentsList = await Appointment.find({
        ...doctorFilter,
        date: { $gte: thirtyDaysAgo },
      });

      const activePatientIds = new Set();
      recentAppointmentsList.forEach((apt) => {
        if (apt.patientId) {
          activePatientIds.add(apt.patientId.toString());
        }
      });

      // Get last period active patients for comparison
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const lastPeriodAppointments = await Appointment.find({
        ...doctorFilter,
        date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      });

      const lastPeriodActivePatients = new Set();
      lastPeriodAppointments.forEach((apt) => {
        if (apt.patientId) {
          lastPeriodActivePatients.add(apt.patientId.toString());
        }
      });

      const activePatientGrowth =
        lastPeriodActivePatients.size > 0
          ? Math.round(
              ((activePatientIds.size - lastPeriodActivePatients.size) /
                lastPeriodActivePatients.size) *
                100
            )
          : 0;

      // Scheduled appointments (upcoming)
      const scheduledAppointments = await Appointment.countDocuments({
        ...doctorFilter,
        status: "upcoming",
        date: { $gte: now },
      });

      const lastMonthScheduled = await Appointment.countDocuments({
        ...doctorFilter,
        status: "upcoming",
        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
      });

      const scheduledGrowth =
        lastMonthScheduled > 0
          ? Math.round(
              ((scheduledAppointments - lastMonthScheduled) /
                lastMonthScheduled) *
                100
            )
          : 0;

      // Completed today
      const completedToday = await Appointment.countDocuments({
        ...doctorFilter,
        status: "completed",
        completedAt: { $gte: todayStart, $lt: todayEnd },
      });

      // Get yesterday's completed for comparison
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const completedYesterday = await Appointment.countDocuments({
        ...doctorFilter,
        status: "completed",
        completedAt: { $gte: yesterdayStart, $lt: todayStart },
      });

      const completedGrowth =
        completedYesterday > 0
          ? Math.round(
              ((completedToday - completedYesterday) / completedYesterday) * 100
            )
          : 0;

      metrics = {
        totalPatients: uniquePatientIds.size,
        totalPatientsGrowth: patientGrowth,
        activePatients: activePatientIds.size,
        activePatientsGrowth: activePatientGrowth,
        scheduledAppointments,
        scheduledAppointmentsGrowth: scheduledGrowth,
        completedToday,
        completedTodayGrowth: completedGrowth,
      };

      // Get recent patients (last 5 unique patients with appointments)
      const recentApts = await Appointment.find(doctorFilter)
        .populate("patientId", "firstName lastName email birthday city")
        .sort({ createdAt: -1 })
        .limit(50);

      const seenPatients = new Set();
      const patientsData = [];

      for (const apt of recentApts) {
        if (
          apt.patientId &&
          apt.patientId._id &&
          !seenPatients.has(apt.patientId._id.toString())
        ) {
          seenPatients.add(apt.patientId._id.toString());

          // Calculate age from birthday
          let age = null;
          if (apt.patientId.birthday) {
            const birthDate = new Date(apt.patientId.birthday);
            age = now.getFullYear() - birthDate.getFullYear();
            const monthDiff = now.getMonth() - birthDate.getMonth();
            if (
              monthDiff < 0 ||
              (monthDiff === 0 && now.getDate() < birthDate.getDate())
            ) {
              age--;
            }
          }

          // Determine status based on recent activity
          const recentApt = await Appointment.findOne({
            doctorId,
            patientId: apt.patientId._id,
          }).sort({ date: -1 });

          let status = "Inactive";
          if (recentApt) {
            const daysSinceLastVisit = Math.floor(
              (now - new Date(recentApt.date)) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastVisit <= 30) {
              status = "Active";
            } else if (recentApt.status === "upcoming") {
              status = "Pending";
            }
          }

          patientsData.push({
            _id: apt.patientId._id,
            firstName: apt.patientId.firstName || "",
            lastName: apt.patientId.lastName || "",
            age: age || "N/A",
            city: apt.patientId.city || "N/A",
            status,
            lastVisit: recentApt
              ? new Date(recentApt.date).toISOString()
              : null,
          });

          if (patientsData.length >= 5) break;
        }
      }

      recentPatients = patientsData;

      // Get recent appointments (last 5)
      const recentAptsData = await Appointment.find(doctorFilter)
        .populate("patientId", "firstName lastName")
        .populate("doctorId", "name")
        .sort({ createdAt: -1 })
        .limit(5);

      recentAppointments = recentAptsData.map((apt) => ({
        _id: apt._id,
        patientName: apt.patientId
          ? `${apt.patientId.firstName || ""} ${apt.patientId.lastName || ""}`.trim()
          : "Unknown",
        doctorName: apt.doctorId ? apt.doctorId.name : "Unknown",
        appointmentType: apt.plan || "consultation",
        status:
          apt.status === "upcoming"
            ? "Scheduled"
            : apt.status === "completed"
              ? "Completed"
              : "Cancelled",
        date: apt.date.toISOString().split("T")[0],
        time: apt.slot,
        dateTime: `${apt.date.toISOString().split("T")[0]} ${apt.slot}`,
      }));
    } else if (isAdmin) {
      // Admin sees all system data
      const totalPatients = await User.countDocuments();
      const thisMonthPatients = await User.countDocuments({
        createdAt: { $gte: thisMonthStart },
      });
      const lastMonthPatientsCount = await User.countDocuments({
        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
      });
      const patientGrowth =
        lastMonthPatientsCount > 0
          ? Math.round(
              ((thisMonthPatients - lastMonthPatientsCount) /
                lastMonthPatientsCount) *
                100
            )
          : 0;

      // Active patients
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentAppointmentsList = await Appointment.find({
        date: { $gte: thirtyDaysAgo },
      });

      const activePatientIds = new Set();
      recentAppointmentsList.forEach((apt) => {
        if (apt.patientId) {
          activePatientIds.add(apt.patientId.toString());
        }
      });

      const scheduledAppointments = await Appointment.countDocuments({
        status: "upcoming",
        date: { $gte: now },
      });

      const completedToday = await Appointment.countDocuments({
        status: "completed",
        completedAt: { $gte: todayStart, $lt: todayEnd },
      });

      metrics = {
        totalPatients,
        totalPatientsGrowth: patientGrowth,
        activePatients: activePatientIds.size,
        activePatientsGrowth: 0,
        scheduledAppointments,
        scheduledAppointmentsGrowth: 0,
        completedToday,
        completedTodayGrowth: 0,
      };

      // Get recent patients (last 5)
      const recentPatientsData = await User.find()
        .sort({ createdAt: -1 })
        .limit(5);

      recentPatients = await Promise.all(
        recentPatientsData.map(async (patient) => {
          let age = null;
          if (patient.birthday) {
            const birthDate = new Date(patient.birthday);
            age = now.getFullYear() - birthDate.getFullYear();
            const monthDiff = now.getMonth() - birthDate.getMonth();
            if (
              monthDiff < 0 ||
              (monthDiff === 0 && now.getDate() < birthDate.getDate())
            ) {
              age--;
            }
          }

          const recentApt = await Appointment.findOne({
            patientId: patient._id,
          }).sort({ date: -1 });

          let status = "Inactive";
          if (recentApt) {
            const daysSinceLastVisit = Math.floor(
              (now - new Date(recentApt.date)) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastVisit <= 30) {
              status = "Active";
            } else if (recentApt.status === "upcoming") {
              status = "Pending";
            }
          }

          return {
            _id: patient._id,
            firstName: patient.firstName || "",
            lastName: patient.lastName || "",
            age: age || "N/A",
            city: patient.city || "N/A",
            status,
            lastVisit: recentApt
              ? new Date(recentApt.date).toISOString()
              : null,
          };
        })
      );

      // Get recent appointments (last 5)
      const recentAptsData = await Appointment.find()
        .populate("patientId", "firstName lastName")
        .populate("doctorId", "name")
        .sort({ createdAt: -1 })
        .limit(5);

      recentAppointments = recentAptsData.map((apt) => ({
        _id: apt._id,
        patientName: apt.patientId
          ? `${apt.patientId.firstName || ""} ${apt.patientId.lastName || ""}`.trim()
          : "Unknown",
        doctorName: apt.doctorId ? apt.doctorId.name : "Unknown",
        appointmentType: apt.plan || "consultation",
        status:
          apt.status === "upcoming"
            ? "Scheduled"
            : apt.status === "completed"
              ? "Completed"
              : "Cancelled",
        date: apt.date.toISOString().split("T")[0],
        time: apt.slot,
        dateTime: `${apt.date.toISOString().split("T")[0]} ${apt.slot}`,
      }));
    }

    res.json({
      success: true,
      data: {
        metrics,
        recentPatients,
        recentAppointments,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard analytics",
      error: error.message,
    });
  }
});

// GET /api/analytics/overview - Get comprehensive analytics with charts
router.get("/overview", authenticateDoctorToken, async (req, res) => {
  try {
    const doctorId = req.doctor._id;
    const isDoctor = req.doctor.isDoctor;
    const isAdmin = req.doctor.isAdmin;

    const now = new Date();

    // Get last 6 months for trends
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let filter = {};
    if (isDoctor && !isAdmin) {
      filter.doctorId = doctorId;
    }

    // Get appointments for the last 6 months
    const appointments = await Appointment.find({
      ...filter,
      createdAt: { $gte: sixMonthsAgo },
    }).populate("doctorId", "name specialties");

    // Monthly appointment trends
    const monthlyData = {};
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[monthKey] = {
        completed: 0,
        upcoming: 0,
        cancelled: 0,
      };
    }

    appointments.forEach((apt) => {
      const month = new Date(apt.createdAt);
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey][apt.status]++;
      }
    });

    const months = Object.keys(monthlyData).sort();
    const appointmentTrends = {
      labels: months.map((m) => {
        const [year, month] = m.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      }),
      datasets: [
        {
          label: "Completed",
          data: months.map((m) => monthlyData[m].completed),
        },
        {
          label: "Upcoming",
          data: months.map((m) => monthlyData[m].upcoming),
        },
        {
          label: "Cancelled",
          data: months.map((m) => monthlyData[m].cancelled),
        },
      ],
    };

    // Specialty distribution (admin/all doctors)
    let specialtyData = {};
    if (isAdmin) {
      const doctors = await Doctor.find({ isDoctor: true });
      doctors.forEach((doc) => {
        if (doc.specialties && doc.specialties.length > 0) {
          doc.specialties.forEach((spec) => {
            specialtyData[spec] = (specialtyData[spec] || 0) + 1;
          });
        }
      });
    }

    const specialtyDistribution = {
      labels: Object.keys(specialtyData),
      data: Object.values(specialtyData),
    };

    // Appointment types distribution
    const appointmentTypes = {};
    appointments.forEach((apt) => {
      const type = apt.plan || "consultation";
      appointmentTypes[type] = (appointmentTypes[type] || 0) + 1;
    });

    const appointmentTypeDistribution = {
      labels: Object.keys(appointmentTypes).map(
        (type) => type.charAt(0).toUpperCase() + type.slice(1)
      ),
      data: Object.values(appointmentTypes),
    };

    // Stats
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const totalAppointments = await Appointment.countDocuments(filter);
    const completedToday = await Appointment.countDocuments({
      ...filter,
      status: "completed",
      completedAt: { $gte: todayStart, $lt: todayEnd },
    });

    let activeDoctors = 0;
    let averageRating = 0;

    if (isAdmin) {
      activeDoctors = await Doctor.countDocuments({
        isActive: true,
        isDoctor: true,
      });

      // Get average rating across all doctors
      const ratings = await Rating.find({});
      if (ratings.length > 0) {
        const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
        averageRating = (totalRating / ratings.length).toFixed(1);
      }
    } else if (isDoctor) {
      activeDoctors = 1; // Just this doctor

      // Get this doctor's rating
      const ratings = await Rating.find({ doctorId });
      if (ratings.length > 0) {
        const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
        averageRating = (totalRating / ratings.length).toFixed(1);
      }
    }

    // Recent activity (last 10 actions)
    const recentAppointments = await Appointment.find(filter)
      .populate("patientId", "firstName lastName")
      .populate("doctorId", "name")
      .sort({ updatedAt: -1 })
      .limit(10);

    const recentActivity = recentAppointments.map((apt) => {
      const patientName = apt.patientId
        ? `${apt.patientId.firstName || ""} ${apt.patientId.lastName || ""}`.trim() ||
          "Unknown Patient"
        : "Unknown Patient";
      const doctorName = apt.doctorId ? apt.doctorId.name : "Unknown Doctor";

      // Normalize status to lowercase for comparison
      const status = apt.status?.toLowerCase();

      let description = "";
      let activityType = status;

      if (status === "upcoming") {
        description = `New appointment booked with Dr. ${doctorName}`;
        activityType = "upcoming";
      } else if (status === "completed") {
        description = `Appointment completed with ${patientName}`;
        activityType = "completed";
      } else if (status === "cancelled" || status === "canceled") {
        description = `Appointment cancelled by ${apt.cancelledBy || "user"}`;
        activityType = "cancelled";
      } else {
        // Fallback for any other status
        description = `Appointment ${status || "updated"} - ${patientName} with Dr. ${doctorName}`;
        activityType = status || "updated";
      }

      const timeDiff = now - new Date(apt.updatedAt);
      const minutes = Math.floor(timeDiff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      let timeAgo = "";
      if (days > 0) {
        timeAgo = `${days} day${days > 1 ? "s" : ""} ago`;
      } else if (hours > 0) {
        timeAgo = `${hours} hour${hours > 1 ? "s" : ""} ago`;
      } else if (minutes > 0) {
        timeAgo = `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
      } else {
        timeAgo = "Just now";
      }

      return {
        id: apt._id,
        description,
        time: timeAgo,
        type: activityType,
      };
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalAppointments,
          activeDoctors,
          completedToday,
          averageRating: parseFloat(averageRating),
        },
        charts: {
          appointmentTrends,
          specialtyDistribution,
          appointmentTypeDistribution,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching analytics overview",
      error: error.message,
    });
  }
});

module.exports = router;
