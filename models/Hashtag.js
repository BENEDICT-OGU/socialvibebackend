// socialvibe/backend/models/Hashtag.js
const mongoose = require('mongoose');

const hashtagSchema = new mongoose.Schema({
    // The actual hashtag text (e.g., "travel", "coding")
    tag: {
        type: String,
        required: true,
        unique: true, // This implicitly creates a unique index, no need for separate index() call
        lowercase: true, // Store in lowercase for consistent lookup
        trim: true,
        minlength: 1,
        maxlength: 50
    },
    // The number of times this hashtag has been used
    count: {
        type: Number,
        default: 0,
        min: 0
    },
    // Timestamp for when the hashtag was last updated (used for trending calculations)
    lastUsed: {
        type: Date,
        default: Date.now,
        index: true // Index to quickly find recently used hashtags
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// REMOVED: hashtagSchema.index({ tag: 1 }); // This was redundant due to unique: true

const Hashtag = mongoose.model('Hashtag', hashtagSchema);

module.exports = Hashtag;