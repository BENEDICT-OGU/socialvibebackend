const express = require('express');
const {
  createReel,
  getReels,
  getReel,
  updateReel,
  deleteReel,
  likeReel,
  unlikeReel,
  getAICaptionSuggestions,
  getAIHashtagSuggestions,
  getAIMusicSuggestions,
  uploadVideo,
  recordVoiceover,
  getTrendingSounds,
  getUserReels,
  getReelsByHashtag,
  getReelsByCategory
} = require('../controllers/reelController');
const { protect } = require('../middleware/auth');
const { uploadVideo: uploadVideoMiddleware, uploadAudio } = require('../middleware/upload');
const { processReel } = require('../middleware/videoProcessing');

const router = express.Router();

// Create a reel with all editing features
router.post(
  '/',
  protect,
  uploadVideoMiddleware.single('video'),
  processReel,
  createReel
);

// Upload video for editing (before creating reel)
router.post(
  '/upload',
  protect,
  uploadVideoMiddleware.single('video'),
  uploadVideo
);

// Record voiceover
router.post(
  '/voiceover',
  protect,
  uploadAudio.single('audio'),
  recordVoiceover
);

// Get all reels with filters
router.get('/', getReels);

// Get trending sounds
router.get('/sounds/trending', getTrendingSounds);

// Get reels by hashtag
router.get('/hashtag/:hashtag', getReelsByHashtag);

// Get reels by category
router.get('/category/:category', getReelsByCategory);

// Get user's reels
router.get('/user/:userId', getUserReels);

// Get single reel
router.get('/:id', getReel);

// Update reel (for saving drafts or updating details)
router.patch('/:id', protect, updateReel);

// Delete reel
router.delete('/:id', protect, deleteReel);

// Like a reel
router.post('/:id/like', protect, likeReel);

// Unlike a reel
router.delete('/:id/like', protect, unlikeReel);

// AI Features
router.post('/ai/captions', protect, getAICaptionSuggestions);
router.post('/ai/hashtags', protect, getAIHashtagSuggestions);
router.post('/ai/music', protect, getAIMusicSuggestions);

module.exports = router;