const express = require('express');
const Post = require('../models/Post');
const {protect} = require('../middleware/auth');
const { getHotScore } = require('../utils/hotScore');

const router = express.Router();

// GET /api/feed?lastId=xxxxx
router.get('/', protect, async (req, res) => {
  const { lastId } = req.query;

  const query = lastId
    ? { _id: { $lt: lastId } } // pagination
    : {};

  const posts = await Post.find(query)
    .sort({ _id: -1 })
    .limit(10)
    .populate('user', 'username avatar');

  res.json(posts);
});
router.get('/home', async (req, res) => {
    const posts = await Post.find().populate('user');
  
    const sorted = posts
      .map(post => ({ ...post.toObject(), hotScore: getHotScore(post) }))
      .sort((a, b) => b.hotScore - a.hotScore);
  
    res.json(sorted);
  });

  router.get('/', async (req, res) => {
    const { sort = 'hot' } = req.query;
  
    let posts = await Post.find().populate('user');
  
    if (sort === 'recommended') {
      const { getRecommendedPosts } = require('../utils/recommendation');
      posts = await getRecommendedPosts(req.user.id);
    }
  
    if (sort === 'hot') {
      const { getHotScore } = require('../utils/hotScore');
      posts = posts
        .map(p => ({ ...p.toObject(), hotScore: getHotScore(p) }))
        .sort((a, b) => b.hotScore - a.hotScore);
    }
  
    if (sort === 'latest') {
      posts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  
    res.json(posts);
  });
  
  

module.exports = router;
