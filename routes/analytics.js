const router = require('express').Router();
const analyticController = require('../controllers/analyticController');
const {protect} = require('../middleware/auth');

router.post('/event', protect, analyticController.recordEvent);
router.get('/post/:postId', protect, analyticController.getPostAnalytics);
router.get('/views-over-time/:postId', protect, analyticController.getViewsOverTime);
router.get('/top-hashtags', protect, analyticController.getTopHashtags);
router.get('/reel-stats/:postId', protect, analyticController.getReelStats);
router.get('/active-users', protect, analyticController.getActiveUsers);



module.exports = router;
