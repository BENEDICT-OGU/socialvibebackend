const express = require('express');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const {protect} = require('../middleware/auth');

const router = express.Router();

// Like/Unlike
router.post('/:id/like', protect, async (req, res) => {
  const post = await Post.findById(req.params.id);
  const index = post.likes.indexOf(req.user.id);

  if (index === -1) {
    post.likes.push(req.user.id);
  } else {
    post.likes.splice(index, 1);
  }

  await post.save();
  res.json({ liked: index === -1 });
  await trackPostScore(post._id, 2)
});

// Comment
router.post('/:id/comment', protect, async (req, res) => {
  const comment = await Comment.create({
    post: req.params.id,
    user: req.user.id,
    content: req.body.content
  });

  res.json(comment);
  await trackPostScore(req.params.id, 3);
});

module.exports = router;
