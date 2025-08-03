const express = require('express');
const Follow = require('../models/Follow');
const {protect} = require('../middleware/auth');

const router = express.Router();

router.post('/:id/follow', protect, async (req, res) => {
  const existing = await Follow.findOne({
    follower: req.user.id,
    following: req.params.id
  });

  if (existing) {
    await existing.deleteOne();
    return res.json({ following: false });
  }

  await Follow.create({ follower: req.user.id, following: req.params.id });
  res.json({ following: true });
});

module.exports = router;
