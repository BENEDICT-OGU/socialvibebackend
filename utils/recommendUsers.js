const redis = require('../config/redis');
const User = require('../models/User');

async function getSuggestedUsers(currentUserId, limit = 10) {
  const key = `user:${currentUserId}:interests`;
  const tags = await redis.zRevRange(key, 0, 4);

  const userScores = {};

  for (const tag of tags) {
    const keys = await redis.keys(`user:*:interests`);
    for (const otherKey of keys) {
      if (otherKey === key) continue;
      const score = await redis.zScore(otherKey, tag);
      if (score) {
        const userId = otherKey.split(':')[1];
        userScores[userId] = (userScores[userId] || 0) + parseFloat(score);
      }
    }
  }

  const sortedUsers = Object.entries(userScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  return await User.find({ _id: { $in: sortedUsers } }).select('_id username avatar');
}

module.exports = { getSuggestedUsers };
