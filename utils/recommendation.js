const redis = require('../config/redis');
const Post = require('../models/Post');

async function trackUserInterest(userId, tags) {
  for (const tag of tags) {
    await redis.zIncrBy(`user:${userId}:interests`, 1, tag.toLowerCase());
  }
}

async function getRecommendedPosts(userId, limit = 10) {
  const tags = await redis.zRevRange(`user:${userId}:interests`, 0, 4);
  return await Post.find({ hashtags: { $in: tags } }).limit(limit).populate('user');
}

module.exports = { trackUserInterest, getRecommendedPosts };
