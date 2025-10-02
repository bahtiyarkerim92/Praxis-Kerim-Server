const newsletterController = require("express").Router();
const Newsletter = require("../models/Newsletter");
const { authenticateDoctorToken } = require("../middleware/doctorAuth");
const Doctor = require("../models/Doctor");

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is a doctor/admin
    const doctor = await Doctor.findOne({ email: req.doctor.email });

    if (!doctor || !doctor.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin check error:", error);
    res.status(500).json({ message: "Error checking admin status" });
  }
};

// GET /api/newsletter/subscribers - Get all newsletter subscribers (Admin only)
newsletterController.get(
  "/subscribers",
  authenticateDoctorToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { isActive, search, page = 1, limit = 50 } = req.query;

      // Build query
      const query = {};
      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      // Add search filter
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Fetch subscribers with pagination
      const subscribers = await Newsletter.find(query)
        .populate("userId", "firstName lastName email isEmailValidated")
        .sort({ subscribedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count for pagination
      const totalCount = await Newsletter.countDocuments(query);

      res.status(200).json({
        subscribers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
        },
      });
    } catch (error) {
      console.error("Error fetching newsletter subscribers:", error);
      res
        .status(500)
        .json({ message: "Error fetching newsletter subscribers" });
    }
  }
);

// GET /api/newsletter/stats - Get newsletter statistics (Admin only)
newsletterController.get(
  "/stats",
  authenticateDoctorToken,
  requireAdmin,
  async (req, res) => {
    try {
      const totalSubscribers = await Newsletter.countDocuments();
      const activeSubscribers = await Newsletter.countDocuments({
        isActive: true,
      });
      const unsubscribed = await Newsletter.countDocuments({ isActive: false });

      // Get subscribers by source
      const bySource = await Newsletter.aggregate([
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]);

      // Recent subscribers (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentSubscribers = await Newsletter.countDocuments({
        subscribedAt: { $gte: thirtyDaysAgo },
      });

      res.status(200).json({
        totalSubscribers,
        activeSubscribers,
        unsubscribed,
        bySource: bySource.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentSubscribers,
      });
    } catch (error) {
      console.error("Error fetching newsletter stats:", error);
      res.status(500).json({ message: "Error fetching newsletter stats" });
    }
  }
);

// POST /api/newsletter/unsubscribe/:id - Unsubscribe a user (Admin only)
newsletterController.post(
  "/unsubscribe/:id",
  authenticateDoctorToken,
  requireAdmin,
  async (req, res) => {
    try {
      const newsletter = await Newsletter.findById(req.params.id);

      if (!newsletter) {
        return res.status(404).json({ message: "Subscriber not found" });
      }

      newsletter.isActive = false;
      newsletter.unsubscribedAt = new Date();
      await newsletter.save();

      res.status(200).json({
        message: "Subscriber unsubscribed successfully",
        subscriber: newsletter,
      });
    } catch (error) {
      console.error("Error unsubscribing:", error);
      res.status(500).json({ message: "Error unsubscribing subscriber" });
    }
  }
);

// DELETE /api/newsletter/:id - Delete a subscriber (Admin only)
newsletterController.delete(
  "/:id",
  authenticateDoctorToken,
  requireAdmin,
  async (req, res) => {
    try {
      const newsletter = await Newsletter.findByIdAndDelete(req.params.id);

      if (!newsletter) {
        return res.status(404).json({ message: "Subscriber not found" });
      }

      res.status(200).json({
        message: "Subscriber deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting subscriber:", error);
      res.status(500).json({ message: "Error deleting subscriber" });
    }
  }
);

module.exports = newsletterController;
