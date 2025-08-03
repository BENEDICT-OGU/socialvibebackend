import Reel from '../models/Reel.js';
import User from '../models/User.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { processVideo } from '../services/videoProcessing.js';
import { generateAICaptions, generateAIHashtags, generateAIMusicSuggestions } from '../services/aiService.js';

// Create a new reel with all editing features
export const createReel = async (req, res) => {
  try {
    const {
      caption,
      hashtags,
      taggedUsers,
      location,
      audioTrack,
      voiceover,
      effects,
      captions,
      stickers,
      privacy,
      allowComments,
      allowDuet,
      allowDownload,
      scheduledAt,
      category,
      trimStart,
      trimEnd,
      playbackRate,
      isReversed,
      originalAudioVolume,
      segments
    } = req.body;

    const userId = req.user._id;

    if (!req.processedFiles?.video) {
      return res.status(400).json({ success: false, message: 'Processed video is required' });
    }

    // Upload processed video and thumbnail
    const videoUpload = await uploadToCloudinary(req.processedFiles.video.buffer, {
      folder: 'reels/videos',
      resource_type: 'video'
    });

    const thumbnailUpload = await uploadToCloudinary(req.processedFiles.thumbnail.buffer, {
      folder: 'reels/thumbnails'
    });

    // Process hashtags and mentions
    const hashtagArray = hashtags ? hashtags.split(/\s+/).filter(tag => tag.startsWith('#')) : [];
    const taggedUserArray = taggedUsers ? JSON.parse(taggedUsers) : [];

    // Parse audio track if provided
    let parsedAudioTrack = null;
    if (audioTrack) {
      parsedAudioTrack = JSON.parse(audioTrack);
    }

    // Parse effects if provided
    let parsedEffects = {
      filter: '',
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      zoom: 1
    };
    if (effects) {
      parsedEffects = JSON.parse(effects);
    }

    // Parse captions and stickers if provided
    const parsedCaptions = captions ? JSON.parse(captions) : [];
    const parsedStickers = stickers ? JSON.parse(stickers) : [];

    const newReel = new Reel({
      user: userId,
      videoUrl: videoUpload.secure_url,
      thumbnailUrl: thumbnailUpload.secure_url,
      caption,
      hashtags: hashtagArray,
      taggedUsers: taggedUserArray,
      location,
      audioTrack: parsedAudioTrack,
      voiceover: voiceover ? JSON.parse(voiceover) : null,
      originalAudioVolume: originalAudioVolume || 100,
      effects: parsedEffects,
      captions: parsedCaptions,
      stickers: parsedStickers,
      privacy: privacy || 'public',
      allowComments: allowComments !== 'false',
      allowDuet: allowDuet !== 'false',
      allowDownload: allowDownload !== 'false',
      scheduledAt: scheduledAt || null,
      category: category || 'entertainment',
      trimSettings: {
        start: trimStart || 0,
        end: trimEnd || 0
      },
      playbackRate: playbackRate || 1,
      isReversed: isReversed === 'true',
      segments: segments ? JSON.parse(segments) : []
    });

    await newReel.save();

    // Update user's reel count
    await User.findByIdAndUpdate(userId, { $inc: { reelCount: 1 } });

    res.status(201).json({
      success: true,
      message: 'Reel created successfully',
      reel: newReel
    });
  } catch (error) {
    console.error('Error creating reel:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create reel' 
    });
  }
};

// Upload video for editing
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Video file is required' });
    }

    const videoUpload = await uploadToCloudinary(req.file.buffer, {
      folder: 'reels/temp',
      resource_type: 'video'
    });

    // Get video duration and other metadata
    const videoInfo = await processVideo(req.file.buffer, {});

    res.status(200).json({
      success: true,
      videoUrl: videoUpload.secure_url,
      duration: videoInfo.duration,
      aspectRatio: videoInfo.aspectRatio
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to upload video' 
    });
  }
};

// Record voiceover
export const recordVoiceover = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Audio file is required' });
    }

    const audioUpload = await uploadToCloudinary(req.file.buffer, {
      folder: 'reels/voiceovers',
      resource_type: 'video'
    });

    res.status(200).json({
      success: true,
      voiceoverUrl: audioUpload.secure_url
    });
  } catch (error) {
    console.error('Error uploading voiceover:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to upload voiceover' 
    });
  }
};

// Get all reels with advanced filtering
export const getReels = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      privacy = 'public',
      category,
      sort = 'newest',
      search,
      followingOnly = 'false'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};
    const sortOptions = {};

    // Privacy filter
    if (privacy === 'private' && req.user) {
      query.user = req.user._id;
      query.privacy = 'private';
    } else if (privacy === 'friends' && req.user) {
      const user = await User.findById(req.user._id);
      query.$or = [
        { privacy: 'public' },
        { user: req.user._id },
        { user: { $in: user.following } }
      ];
    } else {
      query.privacy = 'public';
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Search filter
    if (search) {
      query.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { hashtags: { $regex: search, $options: 'i' } }
      ];
    }

    // Following only filter
    if (followingOnly === 'true' && req.user) {
      const user = await User.findById(req.user._id);
      query.user = { $in: user.following };
    }

    // Sort options
    if (sort === 'newest') {
      sortOptions.createdAt = -1;
    } else if (sort === 'popular') {
      sortOptions.likesCount = -1;
    } else if (sort === 'trending') {
      // Trending combines views, likes, and recency
      sortOptions.$expr = {
        $divide: [
          { $add: [
            { $multiply: ["$views", 0.3] },
            { $multiply: [{ $size: "$likes" }, 0.5] },
            { $multiply: [
              { $subtract: [new Date(), "$createdAt"] },
              -0.2
            ]}
          ]},
          1
        ]
      };
    }

    const reels = await Reel.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username profilePhoto')
      .populate('taggedUsers', 'username profilePhoto')
      .lean();

    // Add virtual fields
    const reelsWithCounts = reels.map(reel => ({
      ...reel,
      likesCount: reel.likes?.length || 0,
      commentsCount: reel.comments?.length || 0
    }));

    const total = await Reel.countDocuments(query);

    res.json({
      success: true,
      reels: reelsWithCounts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching reels:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch reels' 
    });
  }
};

// Get reels by hashtag
export const getReelsByHashtag = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const hashtag = req.params.hashtag.startsWith('#') ? req.params.hashtag : `#${req.params.hashtag}`;

    const reels = await Reel.find({ 
      hashtags: { $in: [hashtag] },
      privacy: 'public'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username profilePhoto')
      .lean();

    const total = await Reel.countDocuments({ 
      hashtags: { $in: [hashtag] },
      privacy: 'public'
    });

    res.json({
      success: true,
      reels,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching reels by hashtag:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch reels by hashtag' 
    });
  }
};

// Get reels by category
export const getReelsByCategory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const reels = await Reel.find({ 
      category: req.params.category,
      privacy: 'public'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username profilePhoto')
      .lean();

    const total = await Reel.countDocuments({ 
      category: req.params.category,
      privacy: 'public'
    });

    res.json({
      success: true,
      reels,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching reels by category:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch reels by category' 
    });
  }
};

// Get user's reels
export const getUserReels = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.params.userId;

    // Check if requesting user's own reels
    const isOwnProfile = req.user && req.user._id.toString() === userId;

    const query = { user: userId };
    if (!isOwnProfile) {
      query.privacy = 'public';
    }

    const reels = await Reel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username profilePhoto')
      .lean();

    const total = await Reel.countDocuments(query);

    res.json({
      success: true,
      reels,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching user reels:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch user reels' 
    });
  }
};

// Get single reel with detailed information
export const getReel = async (req, res) => {
  try {
    const reel = await Reel.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate('user', 'username profilePhoto')
      .populate('taggedUsers', 'username profilePhoto')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username profilePhoto'
        }
      });

    if (!reel) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reel not found' 
      });
    }

    // Check if user has liked the reel
    let isLiked = false;
    if (req.user) {
      isLiked = reel.likes.includes(req.user._id);
    }

    res.json({ 
      success: true, 
      reel: {
        ...reel.toObject(),
        likesCount: reel.likes.length,
        commentsCount: reel.comments.length,
        isLiked
      }
    });
  } catch (error) {
    console.error('Error fetching reel:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch reel' 
    });
  }
};

// Like a reel
export const likeReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reel not found' 
      });
    }

    const userId = req.user._id;

    if (reel.likes.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already liked this reel' 
      });
    }

    reel.likes.push(userId);
    await reel.save();

    res.json({ 
      success: true, 
      message: 'Reel liked',
      likesCount: reel.likes.length
    });
  } catch (error) {
    console.error('Error liking reel:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to like reel' 
    });
  }
};

// Unlike a reel
export const unlikeReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reel not found' 
      });
    }

    const userId = req.user._id;

    if (!reel.likes.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have not liked this reel' 
      });
    }

    reel.likes = reel.likes.filter(id => id.toString() !== userId.toString());
    await reel.save();

    res.json({ 
      success: true, 
      message: 'Reel unliked',
      likesCount: reel.likes.length
    });
  } catch (error) {
    console.error('Error unliking reel:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to unlike reel' 
    });
  }
};

// Get trending sounds
export const getTrendingSounds = async (req, res) => {
  try {
    // This would typically aggregate from reels to find trending sounds
    const trendingSounds = await Reel.aggregate([
      { $match: { 'audioTrack.url': { $exists: true } } },
      { $group: { 
        _id: '$audioTrack.url', 
        name: { $first: '$audioTrack.name' },
        count: { $sum: 1 },
        lastUsed: { $max: '$createdAt' }
      }},
      { $sort: { count: -1, lastUsed: -1 } },
      { $limit: 20 },
      { $project: { 
        _id: 0,
        url: '$_id',
        name: 1,
        reelCount: '$count'
      }}
    ]);

    res.json({
      success: true,
      sounds: trendingSounds
    });
  } catch (error) {
    console.error('Error fetching trending sounds:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch trending sounds' 
    });
  }
};

// Get AI caption suggestions
export const getAICaptionSuggestions = async (req, res) => {
  try {
    const { videoDescription } = req.body;
    
    if (!videoDescription) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video description is required' 
      });
    }

    const suggestions = await generateAICaptions(videoDescription);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error generating AI captions:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to generate AI captions' 
    });
  }
};

// Get AI hashtag suggestions
export const getAIHashtagSuggestions = async (req, res) => {
  try {
    const { videoDescription } = req.body;
    
    if (!videoDescription) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video description is required' 
      });
    }

    const suggestions = await generateAIHashtags(videoDescription);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error generating AI hashtags:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to generate AI hashtags' 
    });
  }
};

// Get AI music suggestions
export const getAIMusicSuggestions = async (req, res) => {
  try {
    const { videoDescription, mood } = req.body;
    
    if (!videoDescription) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video description is required' 
      });
    }

    const suggestions = await generateAIMusicSuggestions(videoDescription, mood);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error generating AI music suggestions:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to generate AI music suggestions' 
    });
  }
};

// Update reel
export const updateReel = async (req, res) => {
  try {
    const {
      caption,
      hashtags,
      taggedUsers,
      privacy,
      allowComments,
      allowDuet,
      allowDownload
    } = req.body;

    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reel not found' 
      });
    }

    // Check if user owns the reel
    if (reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this reel' 
      });
    }

    // Update fields
    if (caption !== undefined) reel.caption = caption;
    if (hashtags !== undefined) reel.hashtags = hashtags.split(/\s+/).filter(tag => tag.startsWith('#'));
    if (taggedUsers !== undefined) reel.taggedUsers = JSON.parse(taggedUsers);
    if (privacy !== undefined) reel.privacy = privacy;
    if (allowComments !== undefined) reel.allowComments = allowComments;
    if (allowDuet !== undefined) reel.allowDuet = allowDuet;
    if (allowDownload !== undefined) reel.allowDownload = allowDownload;

    await reel.save();

    res.json({
      success: true,
      message: 'Reel updated successfully',
      reel
    });
  } catch (error) {
    console.error('Error updating reel:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to update reel' 
    });
  }
};

// Delete reel
export const deleteReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reel not found' 
      });
    }

    // Check if user owns the reel
    if (reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this reel' 
      });
    }

    // Delete video and thumbnail from storage
    await deleteFromCloudinary(reel.videoUrl);
    await deleteFromCloudinary(reel.thumbnailUrl);

    // Delete reel from database
    await Reel.findByIdAndDelete(req.params.id);

    // Update user's reel count
    await User.findByIdAndUpdate(req.user._id, { $inc: { reelCount: -1 } });

    res.json({
      success: true,
      message: 'Reel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reel:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to delete reel' 
    });
  }
};