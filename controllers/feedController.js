const Post = require('../models/Post');
const Follow = require('../models/Follow');

exports.getSmartFeed = async (userId, lastId = null) => {
  const followed = await Follow.find({ follower: userId }).select('following');
  const followedIds = followed.map(f => f.following);

  const query = {
    $or: [
      { user: { $in: followedIds } },
      { hashtags: { $in: ['trending', 'news'] } } // add trending logic
    ]
  };

  if (lastId) query._id = { $lt: lastId };

  return await Post.find(query)
    .sort({ _id: -1 })
    .limit(10)
    .populate('user', 'username avatar');
};
