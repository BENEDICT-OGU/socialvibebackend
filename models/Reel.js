const mongoose = require('mongoose');
const slugify = require('slugify');

const reelSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reel must belong to a user']
    },
    videoUrl: {
      type: String,
      required: [true, 'Reel must have a video URL']
    },
    thumbnailUrl: {
      type: String,
      required: [true, 'Reel must have a thumbnail URL']
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [2200, 'Caption must be less than 2200 characters']
    },
    hashtags: [String],
    taggedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    location: {
      type: String,
      trim: true
    },
    // Audio settings from frontend
    audioTrack: {
      name: String,
      url: String,
      volume: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
      }
    },
    voiceover: {
      url: String,
      volume: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
      }
    },
    originalAudioVolume: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    // Video editing settings from frontend
    trimSettings: {
      start: Number,
      end: Number
    },
    playbackRate: {
      type: Number,
      default: 1
    },
    isReversed: {
      type: Boolean,
      default: false
    },
    // Visual effects from frontend
    effects: {
      filter: String,
      brightness: {
        type: Number,
        default: 100
      },
      contrast: {
        type: Number,
        default: 100
      },
      saturation: {
        type: Number,
        default: 100
      },
      blur: {
        type: Number,
        default: 0
      },
      zoom: {
        type: Number,
        default: 1
      }
    },
    // Text and overlays from frontend
    captions: [
      {
        text: String,
        position: {
          x: Number,
          y: Number
        },
        color: String,
        fontSize: Number,
        animation: String
      }
    ],
    stickers: [
      {
        url: String,
        position: {
          x: Number,
          y: Number
        },
        scale: Number,
        rotation: Number
      }
    ],
    // Post settings from frontend
    privacy: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public'
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    allowDuet: {
      type: Boolean,
      default: true
    },
    allowDownload: {
      type: Boolean,
      default: true
    },
    scheduledAt: Date,
    category: {
      type: String,
      enum: [
        'entertainment',
        'comedy',
        'dance',
        'music',
        'education',
        'sports',
        'food',
        'travel',
        'fashion',
        'beauty',
        'gaming',
        'art',
        'science',
        'other'
      ],
      default: 'entertainment'
    },
    // Engagement metrics
    views: {
      type: Number,
      default: 0
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
      }
    ],
    shares: {
      type: Number,
      default: 0
    },
    // Video metadata
    duration: Number,
    aspectRatio: String,
    slug: String,
    // For video segments (if multiple clips are used)
    segments: [
      {
        url: String,
        duration: Number,
        order: Number
      }
    ],
    // AI generated content
    aiGenerated: {
      captions: [String],
      hashtags: [String],
      musicSuggestions: [
        {
          name: String,
          url: String,
          mood: String
        }
      ]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
reelSchema.index({ user: 1 });
reelSchema.index({ hashtags: 1 });
reelSchema.index({ likes: 1 });
reelSchema.index({ createdAt: -1 });
reelSchema.index({ caption: 'text' });

// Virtual properties
reelSchema.virtual('likesCount').get(function () {
  return this.likes.length;
});

reelSchema.virtual('commentsCount').get(function () {
  return this.comments.length;
});

// Pre-save hook to generate slug
reelSchema.pre('save', function (next) {
  if (this.caption) {
    this.slug = slugify(this.caption.substring(0, 50), { lower: true });
  }
  next();
});

const Reel = mongoose.model('Reel', reelSchema);

module.exports = Reel;