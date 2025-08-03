const redisClient = require('../config/redis');

async function logUserView(userId, postId) {
  await redisClient.sAdd(`user:${userId}:viewed_posts`, postId);
}

async function getUserViewedPosts(userId) {
  return await redisClient.sMembers(`user:${userId}:viewed_posts`);
}

module.exports = {
  logUserView,
  getUserViewedPosts
};
