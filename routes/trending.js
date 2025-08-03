const express = require('express');
const { getTrendingHashtags } = require('../utils/trending');
const Post = require('../models/Post');
const { getCache, setCache } = require('../utils/cache');

const router = express.Router();

router.get('/hashtags', async (req, res) => {
  const trending = await getTrendingHashtags(10);
  res.json(trending);
});

router.get('/posts', async (req, res) => {
    const ranked = await getTrendingPosts(10);
    const ids = ranked.map(item => item.value);
    const posts = await Post.find({ _id: { $in: ids } }).populate('user');
  
    // Match order to Redis score order
    const ordered = ids.map(id => posts.find(p => p._id.toString() === id));
  
    res.json(ordered);
  });

  router.get('/hashtags', async (req, res) => {
    const cached = getCache('trending_hashtags');
    if (cached) return res.json(cached);
  
    const trending = await getTrendingHashtags();
    setCache('trending_hashtags', trending);
  
    res.json(trending);
  });
module.exports = router;
