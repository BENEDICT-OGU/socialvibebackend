
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const upload = require('../utils/multer');
const { validate } = require('../middleware/validate');
const {
  updateProfileValidation,
  changePasswordValidation,
  usernameParamValidation,
  followUserValidation,
  searchUsersValidation
} = require('../validators/profileValidation');

// Debug: Verify all required methods are available
console.log('[Route Debug] Required methods:', {
  protect: typeof protect,
  validate: typeof validate,
  upload: {
    single: typeof upload.single,
    none: typeof upload.none
  },
  controller: {
    getProfile: typeof profileController.getProfile,
    updateProfile: typeof profileController.updateProfile,
    uploadAvatar: typeof profileController.uploadAvatar
  }
});

// ======================
// PROFILE ROUTES
// ======================

// Get current user's profile
router.get('/me', 
  protect, 
  (req, res, next) => {
    console.log('[Route] GET /me triggered');
    next();
  },
  profileController.getProfile
);

// Update profile
router.put('/me',
  protect,
  upload.none(),
  updateProfileValidation,
  validate,
  (req, res, next) => {
    console.log('[Route] PUT /me - Validated data:', req.body);
    next();
  },
  profileController.updateProfile
);

// Change password
router.patch('/me/password',
  protect,
  changePasswordValidation,
  validate,
  profileController.changePassword
);

// ======================
// AVATAR & COVER PHOTOS
// ======================

// Upload avatar
router.post('/me/avatar',
  protect,
  upload.single('avatar'),
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    console.log('[Route] Avatar upload:', req.file);
    next();
  },
  profileController.uploadAvatar
);

// Upload cover photo
router.post('/me/cover',
  protect,
  upload.single('cover'),
  profileController.uploadCoverPhoto
);

// ======================
// PUBLIC PROFILE ROUTES
// ======================

// Get public profile
router.get('/:username',
  usernameParamValidation,
  validate,
  profileController.getPublicProfile
);

// Get followers list
router.get('/:username/followers',
  usernameParamValidation,
  validate,
  profileController.getFollowers
);

// Get following list
router.get('/:username/following',
  usernameParamValidation,
  validate,
  profileController.getFollowing
);

// ======================
// SOCIAL ACTIONS
// ======================

// Follow user
router.post('/follow/:userId',
  protect,
  followUserValidation,
  validate,
  profileController.followUser
);

// Unfollow user
router.post('/unfollow/:userId',
  protect,
  followUserValidation,
  validate,
  profileController.unfollowUser
);

// ======================
// DISCOVERY
// ======================

// Search users
router.get('/search/users',
  searchUsersValidation,
  validate,
  profileController.searchUsers
);

// Get suggested users
router.get('/suggested/users',
  protect,
  profileController.getSuggestedUsers
);

// ======================
// ERROR HANDLER (Fallback)
// ======================
router.use((err, req, res, next) => {
  console.error('[Route Error]', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
  });
});

module.exports = router;