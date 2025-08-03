const Follow = require('../models/Follow');
const Post = require('../models/Post');

async function getPersonalFeed(userId) {
  const following = await Follow.find({ follower: userId }).select('following');
  const followingIds = following.map(f => f.following);
  const personalFeed = await getPersonalFeed(req.user.id);
const recommendedFeed = await getHotFeed(req.user.id);
const fullFeed = [...personalFeed, ...recommendedFeed].slice(0, 30);


  const posts = await Post.find({ user: { $in: followingIds } }).populate('user');
  return posts;
}
