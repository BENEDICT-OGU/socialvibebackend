const { getEngagement } = require('./engagementCache');
const Post = require('../models/Post');

async function getHotFeed(userId) {
  const posts = await Post.find({}).populate('user');

  const enriched = await Promise.all(
    posts.map(async post => {
      const engagement = await getEngagement(post._id);
      const score = getHotScore({ ...post.toObject(), ...engagement });
      return { ...post.toObject(), ...engagement, hotScore: score };
    })
  );

  return enriched.sort((a, b) => b.hotScore - a.hotScore);
}
function getHotScore(post) {
  const { likes, comments, shares, createdAt } = post;
  const ageInHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return (likes || 0) + 2 * (comments || 0) + 3 * (shares || 0) - ageInHours / 24;
}
module.exports = { getHotFeed, getHotScore };