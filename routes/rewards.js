const router = require('express').Router();
const {protect} = require('../middlewares/auth');
const controller = require('../controllers/rewardController');

router.get('/', controller.getRewards);
router.post('/:id/redeem', protect, controller.redeemReward);

module.exports = router;
