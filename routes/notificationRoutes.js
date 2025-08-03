// socialvibe/backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); // Assuming your auth middleware
const NotificationController = require('../controllers/notificationController');
const { validateObjectId } = require('../Validators/SharedValidator'); // Assuming you have a validator for ObjectId

// All notification routes require authentication
router.use(protect);

// @route GET /api/notifications
// @desc Get all notifications for the authenticated user (paginated)
// @access Private
router.get('/', NotificationController.getNotifications);

// @route GET /api/notifications/unread-count
// @desc Get count of unread notifications for the authenticated user
// @access Private
router.get('/unread-count', NotificationController.getUnreadCount);

// @route PUT /api/notifications/:id/read
// @desc Mark a specific notification as read
// @access Private
router.put('/:id/read', validateObjectId('id'), NotificationController.markNotificationAsRead);

// @route PUT /api/notifications/mark-all-read
// @desc Mark all unread notifications for the authenticated user as read
// @access Private
router.put('/mark-all-read', NotificationController.markAllNotificationsAsRead);

// @route DELETE /api/notifications/:id
// @desc Delete a specific notification
// @access Private
router.delete('/:id', validateObjectId('id'), NotificationController.deleteNotification);

module.exports = router;