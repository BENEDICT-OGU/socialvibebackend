const express = require('express');
const router = express.Router();
const { getSuggestedUsers } = require('../utils/recommendUsers');

router.get('/people-you-may-like', async (req, res) => {
  const userId = req.user.id;
  const users = await getSuggestedUsers(userId);
  res.json(users);
});

module.exports = router;
