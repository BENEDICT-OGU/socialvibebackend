const { body, param } = require('express-validator');
const Post = require('../models/Post');

module.exports = {
  createPost: [
    body('content')
      .optional()
      .isString()
      .withMessage('Content must be a string')
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Content cannot exceed 5000 characters'),
    
    body('type')
      .optional()
      .isIn(['text', 'image', 'video', 'poll', 'reel', 'audio', 'story', 'event'])
      .withMessage('Invalid post type'),
    
    body('privacy')
      .optional()
      .isIn(['public', 'friends', 'private', 'close_friends'])
      .withMessage('Invalid privacy setting'),
    
    body('hashtags')
      .optional()
      .isString()
      .withMessage('Hashtags must be a space-separated string'),
    
    body('mentions')
      .optional()
      .isString()
      .withMessage('Mentions must be a space-separated string'),
    
    body('location')
      .optional()
      .isJSON()
      .withMessage('Location must be a valid JSON string'),
    
    body('poll')
      .optional()
      .isJSON()
      .withMessage('Poll must be a valid JSON string')
      .custom(value => {
        const poll = JSON.parse(value);
        if (!poll.question || !poll.options || !poll.endDate) {
          throw new Error('Poll must include question, options, and endDate');
        }
        if (poll.options.length < 2 || poll.options.length > 10) {
          throw new Error('Poll must have between 2-10 options');
        }
        return true;
      })
  ],

  postIdParam: [
    param('postId')
      .exists()
      .withMessage('Post ID is required')
      .isMongoId()
      .withMessage('Invalid Post ID')
      .custom(async (value, { req }) => {
        const post = await Post.findById(value);
        if (!post) {
          throw new Error('Post not found');
        }
        if (post.user.toString() !== req.user._id.toString()) {
          throw new Error('Unauthorized to modify this post');
        }
        return true;
      })
  ]
};