// socialvibe/backend/models/Post.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { v4: uuidv4 } = require('uuid');

const reactionSchema = new mongoose.Schema({
    _id: { type: String, default: uuidv4 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry', 'fire', 'clap'],
        default: 'like'
    },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const commentSchema = new mongoose.Schema({
    _id: { type: String, default: uuidv4 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    attachments: [{
        url: String,
        type: { type: String, enum: ['image', 'video', 'gif', 'audio'] }
    }],
    replies: [{
        _id: { type: String, default: uuidv4 },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: { type: String, required: true, trim: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now }
    }],
    reactions: [reactionSchema],
    isEdited: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const pollOptionSchema = new mongoose.Schema({
    _id: { type: String, default: uuidv4 },
    text: { type: String, required: true },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    percentage: { type: Number, default: 0 }
}, { _id: false });

const postSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    content: {
        type: String,
        trim: true,
        maxlength: 5000
    },
    media: [{
        _id: false,
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video', 'gif', 'audio'] },
        thumbnail: String,
        duration: Number,
        width: Number,
        height: Number,
        altText: String
    }],
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'poll', 'reel', 'audio', 'story', 'event'],
        default: 'text'
    },
    privacy: {
        type: String,
        enum: ['public', 'friends', 'private', 'close_friends'],
        default: 'public'
    },
    reactions: [reactionSchema],
    hashtags: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    tags: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        position: { x: Number, y: Number }
    }],
    location: {
        placeId: String,
        name: String,
        coordinates: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number], default: [0, 0] }
        }
    },
    mood: String,
    activity: String,
    poll: {
        question: String,
        options: [pollOptionSchema],
        endDate: Date,
        isMultiChoice: Boolean,
        totalVotes: { type: Number, default: 0 }
    },
    sharedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    isPinned: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isScheduled: { type: Boolean, default: false },
    scheduledAt: Date,
    expiresAt: Date, // For stories
    viewCount: { type: Number, default: 0 },
    uniqueViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    saveCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    isPromoted: { type: Boolean, default: false },
    promotionDetails: {
        budget: Number,
        duration: Number,
        targetAudience: {
            genders: [String],
            ageRange: { min: Number, max: Number },
            locations: [String],
            interests: [String]
        },
        startDate: Date,
        status: { type: String, enum: ['pending', 'active', 'completed', 'rejected'] }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
postSchema.index({ createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ 'location.coordinates': '2dsphere' });
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtuals
postSchema.virtual('reactionCount').get(function() {
    return this.reactions.length;
});

// Important: Ensure the comments array is actually present in the schema for this virtual to work.
// If you want to use the 'comments' array, uncomment the following line in the main postSchema:
// comments: [commentSchema],
// For now, I'm assuming you want the richer `commentSchema` with replies and reactions.
// If you uncommented comments: [commentSchema] in the main postSchema, then this virtual would be active:
// postSchema.virtual('commentCount').get(function() {
//     return this.comments.length;
// });

postSchema.virtual('likeCount').get(function() {
    return this.reactions.filter(r => r.type === 'like').length;
});

// Plugins
postSchema.plugin(mongoosePaginate);

// Middleware
postSchema.pre('save', function(next) {
    if (this.poll && this.poll.options) {
        const totalVotes = this.poll.options.reduce((sum, option) => sum + option.voters.length, 0);
        this.poll.totalVotes = totalVotes;

        this.poll.options.forEach(option => {
            option.percentage = totalVotes > 0 ? Math.round((option.voters.length / totalVotes) * 100) : 0;
        });
    }
    next();
});

module.exports = mongoose.model('Post', postSchema);