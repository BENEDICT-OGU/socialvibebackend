const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const Report = require('../models/Report');
const SupportTicket = require('../models/SupportTicket');

router.use(adminAuth);

// List users with pagination
router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;

  try {
    const users = await User.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-password'); // hide password hashes

    const total = await User.countDocuments();

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Ban or unban a user
router.post('/users/:id/ban', async (req, res) => {
  const { ban } = req.body; // expect boolean true/false
  try {
    await User.findByIdAndUpdate(req.params.id, { isBanned: ban });
    res.json({ message: `User ${ban ? 'banned' : 'unbanned'}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user roles
router.post('/users/:id/roles', async (req, res) => {
  const { roles } = req.body; // e.g., ['user', 'moderator']
  try {
    await User.findByIdAndUpdate(req.params.id, { roles });
    res.json({ message: 'User roles updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch reports with pagination
router.get('/reports', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  try {
    const reports = await Report.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reportedBy reportedPost reportedComment')
      .sort({ createdAt: -1 });

    const total = await Report.countDocuments();

    res.json({ reports, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark report as resolved
router.post('/reports/:id/resolve', async (req, res) => {
  try {
    await Report.findByIdAndUpdate(req.params.id, { resolved: true });
    res.json({ message: 'Report resolved' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch support tickets with pagination
router.get('/tickets', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  try {
    const tickets = await SupportTicket.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await SupportTicket.countDocuments();

    res.json({ tickets, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
