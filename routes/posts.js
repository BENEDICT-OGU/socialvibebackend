const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const PostController = require("../controllers/postController");
const cacheMiddleware = require('../middleware/cacheMiddleware');
const { 
  createPost: validateCreatePost, 
  postIdParam 
} = require('../Validators/PostValidator');

/**
 * @route POST /api/posts
 * @description Create a new post with optional media
 * @access Private
 * @consumes multipart/form-data
 * @param {file} media - Media files (max 10)
 * @param {file} thumbnail - Thumbnail for video (max 1)
 * @param {string} content - Post content
 * @param {object} poll - Poll data (if applicable)
 */
router.post(
  "/",
  protect,
  upload.fields([
    { name: 'media', maxCount: 10 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  validateCreatePost,
  PostController.createPost
);

/**
 * @route GET /api/posts
 * @description Get feed posts for authenticated user
 * @access Private
 * @query {number} [page=1] - Pagination page
 * @query {number} [limit=10] - Posts per page
 */
router.get("/", protect, PostController.getFeedPosts);

/**
 * @route GET /api/posts/:postId
 * @description Get single post by ID
 * @access Private
 */
router.get('/:postId', protect, PostController.getPost);

/**
 * @route PUT /api/posts/:postId/like
 * @description Like a post
 * @access Private
 */
router.put("/:postId/like", protect, PostController.likePost);

/**
 * @route PUT /api/posts/:postId/unlike
 * @description Remove like from a post
 * @access Private
 */
router.put("/:postId/unlike", protect, PostController.unlikePost);

/**
 * @route PUT /api/posts/:postId/reaction
 * @description Add or update reaction to a post
 * @access Private
 * @param {string} type - Reaction type (like, love, laugh, etc.)
 */
router.put("/:postId/reaction", protect, PostController.addOrUpdateReaction);

/**
 * @route DELETE /api/posts/:postId/reaction
 * @description Remove reaction from a post
 * @access Private
 */
router.delete("/:postId/reaction", protect, PostController.removeReaction);

/**
 * @route POST /api/posts/:postId/comment
 * @description Add comment to a post
 * @access Private
 * @param {string} text - Comment text
 */
router.post("/:postId/comment", protect, PostController.addComment);

/**
 * @route POST /api/posts/:postId/comment/:commentId/reply
 * @description Reply to a comment
 * @access Private
 * @param {string} text - Reply text
 */
router.post("/:postId/comment/:commentId/reply", protect, PostController.addReplyToComment);

/**
 * @route PUT /api/posts/:postId
 * @description Edit a post
 * @access Private
 * @param {string} [content] - Updated content
 * @param {object} [poll] - Updated poll data
 */
router.put("/:postId", protect, postIdParam, PostController.editPost);

/**
 * @route DELETE /api/posts/:postId
 * @description Delete a post
 * @access Private
 */
router.delete("/:postId", protect, postIdParam, PostController.deletePost);

/**
 * @route GET /api/posts/trending/hashtags
 * @description Get top 10 trending hashtags
 * @access Public
 */
router.get('/trending/hashtags', async (req, res) => {
  try {
    const Hashtag = require("../models/Hashtag");
    const hashtags = await Hashtag.find()
      .sort({ count: -1 })
      .limit(10);
    res.json(hashtags);
  } catch (err) {
    console.error('Error fetching trending hashtags:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch trending hashtags' 
    });
  }
});

// Add this route before your protected routes
router.get("/public", async (req, res) => {
  try {
    const posts = await Post.find({
      privacy: "public",
      isScheduled: false,
      createdAt: { $lte: new Date() }
    })
    .sort("-createdAt")
    .limit(20)
    .populate("user", "username avatar verified")
    .lean();

    res.json({
      success: true,
      posts: posts.map(post => PostController.transformPost(post))
    });
  } catch (error) {
    console.error("Error fetching public posts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch public posts",
      error: error.message
    });
  }
});

router.get('/', cacheMiddleware(300), async (req, res) => {
  // Your existing route logic
});
module.exports = router;