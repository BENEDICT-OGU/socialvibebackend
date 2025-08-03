// socialvibe/backend/models/Notification.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const notificationSchema = new mongoose.Schema({
    user: { // The recipient of the notification
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Index for efficient querying by user
    },
    source: { // The user who triggered the notification (e.g., the user who liked a post)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sourceType: { // What type of entity triggered the notification (e.g., 'Post', 'Comment', 'Follow', 'Message')
        type: String,
        enum: ['User', 'Post', 'Comment', 'Message', 'Event', 'Group'], // Extend as needed
        required: true
    },
    sourceId: { // The ID of the actual entity (e.g., postId, commentId)
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    type: { // The specific action type (e.g., 'like', 'comment', 'follow', 'mention', 'message_received')
        type: String,
        enum: [
            'like', 'comment', 'reply', 'follow', 'mention',
            'message_received', 'post_shared', 'event_invite',
            'group_invite', 'friend_request', 'friend_request_accepted'
        ], // Extend as needed
        required: true,
        index: true // Index for filtering by type
    },
    message: { // A concise message for display
        type: String,
        required: true,
        trim: true,
        maxlength: 250
    },
    read: { // Whether the notification has been read by the user
        type: Boolean,
        default: false,
        index: true // Index for querying unread notifications
    },
    metadata: { // Optional: for additional data if needed (e.g., comment text snippet)
        type: mongoose.Schema.Types.Mixed // Allows for flexible data types
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Add pagination plugin to the schema
notificationSchema.plugin(mongoosePaginate);

// Compound index for efficiency when fetching unread notifications for a user
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;