// socialvibe/backend/controllers/notificationController.js
const Notification = require('../models/Notifications');
const logger = require('../config/logger'); // Assuming you have your logger setup
const User = require('../models/User'); // Assuming you might need user details for some notifications

class NotificationController {
    /**
     * Helper to create a new notification.
     * This method is intended to be called by other controllers (e.g., PostController)
     * when an event that warrants a notification occurs.
     */
    static async createNotification(data) {
        try {
            const { user, source, sourceType, sourceId, type, message, metadata } = data;

            // Prevent self-notification if source is the same as the recipient, for certain types
            if (user.toString() === source.toString() && ['like', 'comment', 'reply', 'follow', 'mention'].includes(type)) {
                logger.debug(`Prevented self-notification of type '${type}' for user ${user}.`);
                return null;
            }

            const newNotification = new Notification({
                user,
                source,
                sourceType,
                sourceId,
                type,
                message,
                metadata: metadata || {}
            });
            await newNotification.save();
            logger.info(`Notification created: Type='${type}', Recipient='${user}', Source='${source}'.`);

            // Optional: Implement real-time notification (e.g., Socket.IO, WebSockets) here
            // e.g., io.to(user.toString()).emit('newNotification', newNotification);

            return newNotification;
        } catch (error) {
            logger.error('Error creating notification:', error);
            // Don't re-throw, as failing to create a notification shouldn't break the primary action
            return null;
        }
    }

    /**
     * Get notifications for the authenticated user.
     * Supports pagination and filtering by read status.
     */
    static async getNotifications(req, res) {
        try {
            const { _id: userId } = req.user; // Authenticated user ID
            const { page = 1, limit = 10, readStatus = 'all' } = req.query; // 'all', 'read', 'unread'

            const query = { user: userId };
            if (readStatus === 'read') {
                query.read = true;
            } else if (readStatus === 'unread') {
                query.read = false;
            }

            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { createdAt: -1 }, // Sort by newest first
                populate: [ // Populate source user details
                    { path: 'source', select: 'username avatar verified' }
                ],
                lean: true // Return plain JavaScript objects for better performance
            };

            const result = await Notification.paginate(query, options);

            logger.info(`Fetched notifications for user ${userId}. Page: ${page}, Limit: ${limit}, Read Status: ${readStatus}. Total: ${result.totalDocs}`);

            res.json({
                success: true,
                notifications: result.docs,
                total: result.totalDocs,
                page: result.page,
                pages: result.totalPages,
                limit: result.limit,
                hasPrevPage: result.hasPrevPage,
                hasNextPage: result.hasNextPage
            });
        } catch (error) {
            logger.error('Error fetching notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch notifications',
                error: error.message
            });
        }
    }

    /**
     * Mark a specific notification as read.
     */
    static async markNotificationAsRead(req, res) {
        try {
            const { id } = req.params;
            const { _id: userId } = req.user;

            const notification = await Notification.findOneAndUpdate(
                { _id: id, user: userId, read: false }, // Find by ID and ensure it belongs to the user and is unread
                { $set: { read: true } },
                { new: true } // Return the updated document
            );

            if (!notification) {
                logger.warn(`Notification ${id} not found, already read, or does not belong to user ${userId}.`);
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found or already read'
                });
            }

            logger.info(`Notification ${id} marked as read by user ${userId}.`);
            res.json({
                success: true,
                message: 'Notification marked as read',
                notification
            });
        } catch (error) {
            logger.error(`Error marking notification ${req.params.id} as read:`, error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark notification as read',
                error: error.message
            });
        }
    }

    /**
     * Mark all unread notifications for the authenticated user as read.
     */
    static async markAllNotificationsAsRead(req, res) {
        try {
            const { _id: userId } = req.user;

            const result = await Notification.updateMany(
                { user: userId, read: false },
                { $set: { read: true } }
            );

            logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}.`);
            res.json({
                success: true,
                message: `Marked ${result.modifiedCount} notifications as read`,
                modifiedCount: result.modifiedCount
            });
        } catch (error) {
            logger.error('Error marking all notifications as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark all notifications as read',
                error: error.message
            });
        }
    }

    /**
     * Delete a specific notification.
     */
    static async deleteNotification(req, res) {
        try {
            const { id } = req.params;
            const { _id: userId } = req.user;

            const notification = await Notification.findOneAndDelete({
                _id: id,
                user: userId
            });

            if (!notification) {
                logger.warn(`Notification ${id} not found or does not belong to user ${userId} for deletion.`);
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found or you do not have permission to delete it'
                });
            }

            logger.info(`Notification ${id} deleted by user ${userId}.`);
            res.json({
                success: true,
                message: 'Notification deleted successfully'
            });
        } catch (error) {
            logger.error(`Error deleting notification ${req.params.id}:`, error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete notification',
                error: error.message
            });
        }
    }

    /**
     * Get the count of unread notifications for the authenticated user.
     */
    static async getUnreadCount(req, res) {
        try {
            const { _id: userId } = req.user;
            const unreadCount = await Notification.countDocuments({ user: userId, read: false });

            logger.info(`Unread notification count for user ${userId}: ${unreadCount}`);
            res.json({
                success: true,
                unreadCount
            });
        } catch (error) {
            logger.error('Error getting unread notification count:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get unread count',
                error: error.message
            });
        }
    }
}

module.exports = NotificationController;