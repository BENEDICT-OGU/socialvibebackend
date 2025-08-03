const express = require("express");
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/auth");
const User = require("../models/User");
const {
  blockUser,
  reportUser,
  updatePreferences,
} = require("../controllers/userController");

const router = express.Router();

// Configure avatar upload storage
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/avatars");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user._id}-${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png, gif) are allowed"));
  },
});

// GET logged-in user's profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -twoFactorSecret -emailVerificationToken -passwordResetToken -passwordResetExpires")
      .populate("followers following", "name username avatar")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Format avatar URL
    if (user.avatar && !user.avatar.startsWith("http")) {
      user.avatar = `${process.env.BASE_URL || "http://localhost:5000"}${user.avatar}`;
    }

    res.json({ success: true, data: user });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// UPDATE profile (text fields)
router.put("/profile", protect, async (req, res) => {
  const { name, bio, username, email, phone } = req.body;

  try {
    const updates = {};
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Username validation
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }
      updates.username = username;
    }

    // Email validation
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: "Email already in use" });
      }
      updates.email = email;
      updates.emailVerified = false; // Require re-verification if email changes
    }

    // Phone validation
    if (phone && phone !== user.phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: "Phone number already in use" });
      }
      updates.phone = phone;
    }

    // Apply updates
    updates.name = name || user.name;
    updates.bio = bio || user.bio;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({ success: true, data: updatedUser });
  } catch (err) {
    console.error("Profile update error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// UPLOAD avatar (separate endpoint for file upload)
router.post(
  "/upload-avatar",
  protect,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarPath },
        { new: true }
      ).select("-password");

      // Format full avatar URL
      updatedUser.avatar = `${process.env.BASE_URL || "http://localhost:5000"}${avatarPath}`;

      res.json({ success: true, data: updatedUser });
    } catch (err) {
      console.error("Avatar upload error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Update user preferences (dark mode, notifications)
router.put("/preferences", protect, updatePreferences);

// Block a user
router.post("/block", protect, blockUser);

// Report a user
router.post("/report", protect, reportUser);

router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;