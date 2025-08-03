const User = require("../models/User");
const Report = require("../models/Report"); // Assuming a Report model exists or create one

// Block a user
exports.blockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { blockUserId } = req.body;

    if (!blockUserId) {
      return res.status(400).json({ message: "User ID to block is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.blockedUsers.includes(blockUserId)) {
      user.blockedUsers.push(blockUserId);
      await user.save();
    }

    res.json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Report a user
exports.reportUser = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { reportedUserId, reason } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: "Reported user ID and reason are required" });
    }

    // Create a report document
    const report = new Report({
      reporter: reporterId,
      reportedUser: reportedUserId,
      reason,
      createdAt: new Date(),
    });

    await report.save();

    res.json({ message: "User reported successfully" });
  } catch (error) {
    console.error("Error reporting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user preferences (dark mode, notifications)
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { darkMode, notificationsEnabled } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (typeof darkMode === "boolean") {
      user.darkMode = darkMode;
    }
    if (typeof notificationsEnabled === "boolean") {
      user.notificationsEnabled = notificationsEnabled;
    }

    await user.save();

    res.json({ message: "Preferences updated successfully" });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ message: "Server error" });
  }
};
