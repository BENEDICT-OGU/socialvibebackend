const express = require('express');
const router = express.Router();
const {protect} = require('../middleware/auth');
const controller = require('../controllers/gamificationController');

router.get('/me', protect, controller.getMyGamificationData);
router.post('/check-in', protect, controller.checkIn);
router.get('/leaderboard', protect, controller.getLeaderboard);

module.exports = router;
