const redis = require('../config/redis');

async function updateEngagement(postId, type) {
  const key = `post:${postId}:engagement`;
  await redis.hIncrBy(key, type, 1);
}

async function getEngagement(postId) {
  const key = `post:${postId}:engagement`;
  const result = await redis.hGetAll(key);
  return {
    likes: parseInt(result.likes || 0),
    comments: parseInt(result.comments || 0),
    shares: parseInt(result.shares || 0)
  };
}

module.exports = { updateEngagement, getEngagement };
