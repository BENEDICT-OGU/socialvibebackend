const Post = require("../models/Post");
const User = require("../models/User");
const Hashtag = require("../models/Hashtag");
const NotificationController = require("./notificationController");
const {
  trackHashtag,
  trackPostScore,
  calculateTrendingScore,
} = require("../utils/trending");
const { addPoints, deductPoints } = require("../utils/pointsEngine");
const {
  generateSignedUrl,
  deleteFileFromStorage,
} = require("../services/storageService");
const {
  filterSensitiveContent,
  detectBannedWords,
} = require("../services/contentModeration");
const PostCache = require("../utils/cache");
const logger = require("../config/logger");
const mongoose = require("mongoose");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function getVideoDuration(filePath) {
  try {
    const { stdout } = await exec(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    return parseFloat(stdout);
  } catch (error) {
    logger.error(`Error getting video duration for ${filePath}:`, error);
    return null;
  }
}

class PostController {
  // Helper method to transform post for frontend
  static transformPost(post) {
    const transformed = {
      ...post,
      // Create images array that frontend expects
      images: post.media.map((mediaItem) => ({
        url: mediaItem.url,
        type: mediaItem.type,
        thumbnail: mediaItem.thumbnail,
        likes: post.reactions
          .filter((r) => r.type === "like")
          .map((r) => r.user?._id || r.user),
        comments: post.comments || [],
      })),
      // Add simplified counts
      likeCount: post.reactions.filter((r) => r.type === "like").length,
      commentCount: post.comments?.length || 0,
    };

    return transformed;
  }

  // Create a new post
  static async createPost(req, res) {
    try {
      const { user, files, body } = req;
      const {
        content,
        type,
        privacy,
        hashtags,
        mentions,
        location,
        mood,
        activity,
        poll,
      } = body;

      // Content moderation
      const moderationResult = await filterSensitiveContent(content || "");
      if (moderationResult.isBlocked) {
        if (files?.media) {
          for (const file of files.media) {
            await deleteFileFromStorage(file.path);
          }
        }
        return res.status(400).json({
          success: false,
          message: "Post contains inappropriate content",
          reasons: moderationResult.reasons,
        });
      }

      // Process media files
      const media = [];
      if (files?.media && files.media.length > 0) {
        for (const file of files.media) {
          const mediaType = file.mimetype.split("/")[0];
          let mediaEntry = {
            url: await generateSignedUrl(file.path),
            type: mediaType,
          };

          if (mediaType === "video") {
            mediaEntry.thumbnail = files.thumbnail?.[0]
              ? await generateSignedUrl(files.thumbnail[0].path)
              : null;
            mediaEntry.duration = await getVideoDuration(file.path);
          }
          media.push(mediaEntry);
        }
      }

      // Create post
      const post = new Post({
        user: user._id,
        content: moderationResult.filteredContent,
        type: type || (media.length ? media[0].type : "text"),
        media,
        privacy: privacy || "public",
        ...(hashtags && {
          hashtags: hashtags
            .split(" ")
            .map((tag) => tag.replace("#", "").toLowerCase()),
        }),
        ...(mentions && {
          mentions: await User.find({
            username: {
              $in: mentions.split(" ").map((m) => m.replace("@", "")),
            },
          })
            .select("_id")
            .lean(),
        }),
        ...(location && { location: typeof location === 'string' ? JSON.parse(location) : location }),
        mood,
        activity,
        ...(poll && { poll: typeof poll === 'string' ? JSON.parse(poll) : poll }),
      });
      
      await post.save();
      await post.populate("user", "username avatar verified");
      await post.populate("reactions.user", "username avatar");
      await post.populate("comments.user", "username avatar");

      // Transform for frontend
      const transformedPost = this.transformPost(post);

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        post: transformedPost,
      });
    } catch (error) {
      logger.error("Error creating post:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create post",
        error: error.message,
      });
    }
  }

  // Get feed posts (paginated)
 static async getFeedPosts(req, res) {
  try {
    const { user, query } = req;
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 15, 50); // Increased default limit to 15, max 50
    const skip = (page - 1) * limit;

    // Always include user's own posts and public posts
    const conditions = {
      $or: [
        { user: user._id }, // User's own posts
        { privacy: "public" }, // All public posts
      ],
      isScheduled: false,
      createdAt: { $lte: new Date() },
    };

    // Get posts with proper sorting and pagination
    const posts = await Post.find(conditions)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit)
      .populate("user", "username avatar verified")
      .populate("reactions.user", "username avatar")
      .lean();

    // Get total count without applying skip/limit for accurate hasMore calculation
    const total = await Post.countDocuments(conditions);

    // Transform posts for frontend
    const transformedPosts = posts.map((post) => ({
      ...post,
      images: post.media.map((media) => ({
        url: media.url,
        likes: post.reactions
          ?.filter((r) => r.type === "like")
          .map((r) => r.user?._id) || [],
        comments: post.comments || [],
      })),
      likeCount: post.reactions?.filter((r) => r.type === "like").length || 0,
    }));

    res.json({
      success: true,
      posts: transformedPosts,
      page,
      limit,
      total,
      hasMore: skip + limit < total, // More accurate hasMore calculation
    });
  } catch (error) {
    console.error("Error fetching feed posts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch feed posts",
      error: error.message,
    });
  }
}

  // Get single post
  static async getPost(req, res) {
    try {
      const { postId } = req.params;
      const { user } = req;

      const post = await Post.findById(postId)
        .populate("user", "username avatar verified")
        .populate("reactions.user", "username avatar")
        .populate("comments.user", "username avatar")
        .lean();

      if (!post) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      // Check privacy
      if (
        post.privacy === "private" &&
        (!user || post.user._id.toString() !== user._id.toString())
      ) {
        return res
          .status(403)
          .json({ success: false, message: "This post is private" });
      }

      // Transform for frontend
      const transformedPost = this.transformPost(post);

      res.json({ success: true, post: transformedPost });
    } catch (error) {
      logger.error("Error fetching post:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch post",
        error: error.message,
      });
    }
  }
  // Get post details with improved caching
  static async getPost(req, res) {
    try {
      const { postId } = req.params;
      const { user } = req;

      logger.debug(`Fetching post details for ID: ${postId}`);

      // Try cache first
      const cachedPost =
        typeof PostCache.getPost === "function"
          ? await PostCache.getPost(postId)
          : null;
      if (cachedPost) {
        logger.info(`Serving post ${postId} from cache.`);
        if (user) {
          await PostController.trackPostView(postId, user._id);
        }
        return res.json({ success: true, post: cachedPost });
      }

      // Query database
      const post = await Post.findById(postId)
        .populate("user", "username avatar verified")
        .populate("mentions", "username avatar")
        .populate("sharedPost")
        .populate("sharedPost.user", "username avatar verified")
        .lean();

      if (!post) {
        logger.warn(`Post ${postId} not found.`);
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      // Check privacy settings
      if (
        post.privacy === "private" &&
        (!user || post.user._id.toString() !== user._id.toString())
      ) {
        logger.warn(
          `Access denied to private post ${postId} for user ${
            user ? user._id : "unauthenticated"
          }.`
        );
        return res.status(403).json({
          success: false,
          message: "This post is private",
        });
      }

      // Track view if user is authenticated
      if (user) {
        await PostController.trackPostView(postId, user._id);
      }

      // Cache the post
      if (typeof PostCache.setPost === "function") {
        await PostCache.setPost(postId, post);
        logger.debug(`Cached post ${postId} after fetching from DB.`);
      }

      res.json({ success: true, post });
    } catch (error) {
      logger.error("Error fetching post:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch post",
        error: error.message,
      });
    }
  }

  // Like a post with improved reaction handling
  static async likePost(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;

      logger.debug(`User ${userId} attempting to like post ${postId}.`);

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for like action by user ${userId}.`
        );
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      // Check if already liked by this user
      const existingReaction = post.reactions.find(
        (r) => r.user.toString() === userId.toString() && r.type === "like"
      );

      if (existingReaction) {
        logger.info(`User ${userId} already liked post ${postId}.`);
        return res.status(400).json({
          success: false,
          message: "You have already liked this post",
        });
      }

      // Add new like reaction
      post.reactions.push({ user: userId, type: "like" });
      await post.save();
      logger.info(`Post ${postId} liked successfully by user ${userId}.`);

      // Add points for liking
      await addPoints(userId, "like_post");

      // Create notification if not the post owner
      if (post.user.toString() !== userId.toString()) {
        await NotificationController.createNotification({
          user: post.user,
          type: "like",
          source: userId,
          sourceType: "Post",
          sourceId: post._id,
          message: `${req.user.username} liked your post`,
          metadata: { postId: post._id.toString() },
        });
      }

      // Update cache
      if (typeof PostCache.updatePostReactions === "function") {
        await PostCache.updatePostReactions(
          postId,
          post.reactions.map((r) => r.toObject())
        );
      }

      res.json({
        success: true,
        message: "Post liked successfully",
        reactions: post.reactions.map((r) => r.toObject()),
        reactionCount: post.reactionCount,
      });
    } catch (error) {
      logger.error("Error liking post:", error);
      res.status(500).json({
        success: false,
        message: "Failed to like post",
        error: error.message,
      });
    }
  }

  // Unlike a post with improved error handling
  static async unlikePost(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;

      logger.debug(`User ${userId} attempting to unlike post ${postId}.`);

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for unlike action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      const initialReactionCount = post.reactions.length;
      post.reactions = post.reactions.filter(
        (r) => !(r.user.toString() === userId.toString() && r.type === "like")
      );

      if (post.reactions.length === initialReactionCount) {
        logger.info(
          `User ${userId} had no like reaction on post ${postId} to remove.`
        );
        return res
          .status(400)
          .json({ success: false, message: "You have not liked this post" });
      }

      await post.save();
      logger.info(`Post ${postId} unliked successfully by user ${userId}.`);

      await deductPoints(userId, "unlike_post");

      // Update cache
      if (typeof PostCache.updatePostReactions === "function") {
        await PostCache.updatePostReactions(
          postId,
          post.reactions.map((r) => r.toObject())
        );
      }

      res.json({
        success: true,
        message: "Post unliked successfully",
        reactions: post.reactions.map((r) => r.toObject()),
        reactionCount: post.reactionCount,
      });
    } catch (error) {
      logger.error("Error unliking post:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to unlike post",
          error: error.message,
        });
    }
  }

  // Add or update reaction with more reaction types
  static async addOrUpdateReaction(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;
      const { type } = req.body;

      logger.debug(
        `User ${userId} attempting to add/update reaction '${type}' on post ${postId}.`
      );

      if (
        ![
          "like",
          "love",
          "laugh",
          "wow",
          "sad",
          "angry",
          "fire",
          "clap",
        ].includes(type)
      ) {
        logger.warn(
          `Invalid reaction type '${type}' from user ${userId} on post ${postId}.`
        );
        return res
          .status(400)
          .json({ success: false, message: "Invalid reaction type" });
      }

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for reaction action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      const existingReactionIndex = post.reactions.findIndex(
        (r) => r.user.toString() === userId.toString()
      );

      if (existingReactionIndex >= 0) {
        const oldType = post.reactions[existingReactionIndex].type;
        if (oldType !== type) {
          post.reactions[existingReactionIndex].type = type;
          logger.info(
            `User ${userId} updated reaction on post ${postId} from '${oldType}' to '${type}'.`
          );
        } else {
          logger.info(
            `User ${userId} re-sent same reaction '${type}' on post ${postId}. No change.`
          );
          return res
            .status(200)
            .json({
              success: true,
              message: "Reaction already exists with this type",
              post: post.toObject(),
            });
        }
      } else {
        post.reactions.push({ user: userId, type });
        logger.info(
          `User ${userId} added new reaction '${type}' on post ${postId}.`
        );
      }
      await post.save();

      // Update cache
      if (typeof PostCache.updatePostReactions === "function") {
        await PostCache.updatePostReactions(
          postId,
          post.reactions.map((r) => r.toObject())
        );
      }

      res.json({
        success: true,
        message: "Reaction updated",
        post: post.toObject(),
      });
    } catch (error) {
      logger.error("Error adding/updating reaction:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to add/update reaction",
          error: error.message,
        });
    }
  }

  // Remove reaction with better validation
  static async removeReaction(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;

      logger.debug(
        `User ${userId} attempting to remove reaction from post ${postId}.`
      );

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for remove reaction action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      const initialReactionCount = post.reactions.length;
      post.reactions = post.reactions.filter(
        (r) => r.user.toString() !== userId.toString()
      );

      if (post.reactions.length === initialReactionCount) {
        logger.info(
          `User ${userId} had no reaction on post ${postId} to remove.`
        );
        return res
          .status(400)
          .json({
            success: false,
            message: "No reaction found from this user to remove",
          });
      }

      await post.save();
      logger.info(`Reaction removed from post ${postId} by user ${userId}.`);

      // Update cache
      if (typeof PostCache.updatePostReactions === "function") {
        await PostCache.updatePostReactions(
          postId,
          post.reactions.map((r) => r.toObject())
        );
      }

      res.json({
        success: true,
        message: "Reaction removed",
        post: post.toObject(),
      });
    } catch (error) {
      logger.error("Error removing reaction:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to remove reaction",
          error: error.message,
        });
    }
  }

  // Comment on a post with improved validation
  static async addComment(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;
      const { text, attachments } = req.body;

      logger.debug(
        `User ${userId} attempting to add comment on post ${postId}.`
      );

      if (!text || text.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Comment text cannot be empty" });
      }

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for comment action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      const newComment = {
        user: userId,
        text,
        attachments: attachments || [],
        replies: [],
      };

      post.comments.push(newComment);
      await post.save();
      logger.info(`Comment added to post ${postId} by user ${userId}.`);

      await addPoints(userId, "comment_on_post");

      if (post.user.toString() !== userId.toString()) {
        await NotificationController.createNotification({
          user: post.user,
          type: "comment",
          source: userId,
          sourceType: "Post",
          sourceId: post._id,
          message: `${req.user.username} commented on your post`,
          metadata: {
            postId: post._id.toString(),
            commentText: newComment.text.substring(0, 50) + "...",
          },
        });
      }

      // Update cache
      if (typeof PostCache.setPost === "function") {
        await PostCache.setPost(postId, post.toObject());
      }

      res
        .status(201)
        .json({ success: true, message: "Comment added", comment: newComment });
    } catch (error) {
      logger.error("Error adding comment:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to add comment",
          error: error.message,
        });
    }
  }

  // Reply to a comment with improved validation
  static async addReplyToComment(req, res) {
    try {
      const { postId, commentId } = req.params;
      const { _id: userId } = req.user;
      const { text } = req.body;

      logger.debug(
        `User ${userId} attempting to reply to comment ${commentId} on post ${postId}.`
      );

      if (!text || text.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Reply text cannot be empty" });
      }

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for reply action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      const comment = post.comments.id(commentId);
      if (!comment) {
        logger.warn(
          `Comment ${commentId} not found on post ${postId} for reply action.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Comment not found" });
      }

      comment.replies.push({ user: userId, text });
      await post.save();
      logger.info(
        `Reply added to comment ${commentId} on post ${postId} by user ${userId}.`
      );

      if (comment.user.toString() !== userId.toString()) {
        await NotificationController.createNotification({
          user: comment.user,
          type: "reply",
          source: userId,
          sourceType: "Comment",
          sourceId: comment._id,
          message: `${req.user.username} replied to your comment on a post`,
          metadata: {
            postId: post._id.toString(),
            commentId: comment._id.toString(),
            replyText: text.substring(0, 50) + "...",
          },
        });
      }

      // Update cache
      if (typeof PostCache.setPost === "function") {
        await PostCache.setPost(postId, post.toObject());
      }

      res
        .status(201)
        .json({ success: true, message: "Reply added", post: post.toObject() });
    } catch (error) {
      logger.error("Error adding reply:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to add reply",
          error: error.message,
        });
    }
  }

  // Edit your post with improved validation
  static async editPost(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;
      const { content, privacy, hashtags, mentions, location, mood, activity } =
        req.body;

      logger.debug(`User ${userId} attempting to edit post ${postId}.`);

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for edit action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      if (post.user.toString() !== userId.toString()) {
        logger.warn(
          `User ${userId} attempted to edit post ${postId} which is not theirs.`
        );
        return res
          .status(403)
          .json({ success: false, message: "You can only edit your posts" });
      }

      if (content !== undefined) {
        // Content moderation for edited content
        const moderationResult = await filterSensitiveContent(content || "");
        if (moderationResult.isBlocked) {
          logger.warn("Post edit blocked due to inappropriate content.", {
            userId,
            reasons: moderationResult.reasons,
          });
          return res.status(400).json({
            success: false,
            message: "Edited content contains inappropriate material",
            reasons: moderationResult.reasons,
          });
        }
        post.content = moderationResult.filteredContent;
      }

      if (privacy !== undefined) post.privacy = privacy;
      if (hashtags !== undefined) {
        post.hashtags = hashtags
          .split(" ")
          .map((tag) => tag.replace("#", "").toLowerCase());
      }
      if (mentions !== undefined) {
        post.mentions = await User.find({
          username: { $in: mentions.split(" ").map((m) => m.replace("@", "")) },
        })
          .select("_id")
          .lean();
      }
      if (location !== undefined) post.location = JSON.parse(location);
      if (mood !== undefined) post.mood = mood;
      if (activity !== undefined) post.activity = activity;

      post.isEdited = true;
      post.editedAt = new Date();
      await post.save();
      logger.info(`Post ${postId} edited successfully by user ${userId}.`);

      // Update cache
      if (typeof PostCache.setPost === "function") {
        await PostCache.setPost(postId, post.toObject());
      }

      res.json({
        success: true,
        message: "Post updated successfully",
        post: post.toObject(),
      });
    } catch (error) {
      logger.error("Error editing post:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to edit post",
          error: error.message,
        });
    }
  }

  // Delete your post with improved media cleanup
  static async deletePost(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;

      logger.debug(`User ${userId} attempting to delete post ${postId}.`);

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for delete action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      if (post.user.toString() !== userId.toString()) {
        logger.warn(
          `User ${userId} attempted to delete post ${postId} which is not theirs.`
        );
        return res
          .status(403)
          .json({ success: false, message: "You can only delete your posts" });
      }

      // Delete associated media files from storage
      if (post.media && post.media.length > 0) {
        await Promise.all(
          post.media.map(async (mediaItem) => {
            try {
              await deleteFileFromStorage(mediaItem.url);
              if (mediaItem.thumbnail) {
                await deleteFileFromStorage(mediaItem.thumbnail);
              }
              logger.debug(
                `Deleted media file from storage for post ${postId}: ${mediaItem.url}`
              );
            } catch (storageErr) {
              logger.error(
                `Failed to delete media from storage for post ${postId}: ${mediaItem.url}`,
                storageErr
              );
            }
          })
        );
      }

      await Post.deleteOne({ _id: postId });
      logger.info(`Post ${postId} deleted successfully by user ${userId}.`);

      await deductPoints(userId, "delete_post");

      // Remove from cache
      if (typeof PostCache.deletePost === "function") {
        await PostCache.deletePost(postId);
      }

      res.json({ success: true, message: "Post deleted successfully" });
    } catch (error) {
      logger.error("Error deleting post:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to delete post",
          error: error.message,
        });
    }
  }

  // Share a post
  static async sharePost(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;
      const { content, privacy } = req.body;

      logger.debug(`User ${userId} attempting to share post ${postId}.`);

      const originalPost = await Post.findById(postId);
      if (!originalPost) {
        logger.warn(
          `Original post ${postId} not found for share action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Original post not found" });
      }

      // Content moderation for share content
      const moderationResult = await filterSensitiveContent(content || "");
      if (moderationResult.isBlocked) {
        logger.warn("Post share blocked due to inappropriate content.", {
          userId,
          reasons: moderationResult.reasons,
        });
        return res.status(400).json({
          success: false,
          message: "Share content contains inappropriate material",
          reasons: moderationResult.reasons,
        });
      }

      const sharedPost = new Post({
        user: userId,
        content: moderationResult.filteredContent,
        type: "share",
        privacy: privacy || "public",
        sharedPost: originalPost._id,
      });

      await sharedPost.save();
      logger.info(
        `Post ${postId} shared successfully by user ${userId} as new post ${sharedPost._id}.`
      );

      // Add points for sharing
      await addPoints(userId, "share_post");

      // Notify original post owner
      if (originalPost.user.toString() !== userId.toString()) {
        await NotificationController.createNotification({
          user: originalPost.user,
          type: "share",
          source: userId,
          sourceType: "Post",
          sourceId: sharedPost._id,
          message: `${req.user.username} shared your post`,
          metadata: {
            postId: sharedPost._id.toString(),
            originalPostId: originalPost._id.toString(),
          },
        });
      }

      // Populate before sending response
      await sharedPost.populate("user", "username avatar verified");
      await sharedPost.populate("sharedPost");
      await sharedPost.populate("sharedPost.user", "username avatar verified");

      res.status(201).json({
        success: true,
        message: "Post shared successfully",
        post: sharedPost,
      });
    } catch (error) {
      logger.error("Error sharing post:", error);
      res.status(500).json({
        success: false,
        message: "Failed to share post",
        error: error.message,
      });
    }
  }

  // Get posts by hashtag
  static async getPostsByHashtag(req, res) {
    try {
      const { hashtag } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      logger.debug(`Fetching posts for hashtag: ${hashtag}`);

      const posts = await Post.find({
        hashtags: hashtag.toLowerCase(),
        privacy: "public",
        isScheduled: false,
        createdAt: { $lte: new Date() },
      })
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .populate("user", "username avatar verified")
        .populate("sharedPost")
        .populate("sharedPost.user", "username avatar verified")
        .lean();

      res.json({
        success: true,
        posts,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: posts.length === parseInt(limit),
      });
    } catch (error) {
      logger.error(`Error fetching posts for hashtag ${hashtag}:`, error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch posts by hashtag",
        error: error.message,
      });
    }
  }

  // Get trending posts
  static async getTrendingPosts(req, res) {
    try {
      const { limit = 10 } = req.query;

      logger.debug("Fetching trending posts");

      // Get cached trending posts if available
      const cacheKey = "trending_posts";
      const cachedPosts =
        typeof PostCache.get === "function"
          ? await PostCache.get(cacheKey)
          : null;

      if (cachedPosts) {
        logger.info("Serving trending posts from cache");
        return res.json({
          success: true,
          posts: cachedPosts.slice(0, limit),
        });
      }

      // Get posts from the last 24 hours with high engagement
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const posts = await Post.find({
        createdAt: { $gte: oneDayAgo },
        privacy: "public",
        isScheduled: false,
      })
        .populate("user", "username avatar verified")
        .lean();

      // Calculate trending scores and sort
      const scoredPosts = posts
        .map((post) => ({
          ...post,
          trendingScore: calculateTrendingScore(post),
        }))
        .sort((a, b) => b.trendingScore - a.trendingScore);

      // Cache the results for 15 minutes
      if (typeof PostCache.set === "function") {
        await PostCache.set(cacheKey, scoredPosts, 900); // 15 minutes
      }

      res.json({
        success: true,
        posts: scoredPosts.slice(0, limit),
      });
    } catch (error) {
      logger.error("Error fetching trending posts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch trending posts",
        error: error.message,
      });
    }
  }

  // Vote in a poll
  static async voteInPoll(req, res) {
    try {
      const { postId } = req.params;
      const { _id: userId } = req.user;
      const { optionIndexes } = req.body; // Array of indexes for multi-choice, single index otherwise

      logger.debug(
        `User ${userId} attempting to vote in poll ${postId} for options: ${optionIndexes}`
      );

      const post = await Post.findById(postId);
      if (!post) {
        logger.warn(
          `Post ${postId} not found for poll vote action by user ${userId}.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      if (!post.poll) {
        logger.warn(`Post ${postId} does not contain a poll.`);
        return res
          .status(400)
          .json({
            success: false,
            message: "This post does not contain a poll",
          });
      }

      if (new Date(post.poll.endDate) < new Date()) {
        logger.warn(`Poll ${postId} has already ended.`);
        return res
          .status(400)
          .json({ success: false, message: "This poll has already ended" });
      }

      // Convert to array if single option
      const optionsToVote = Array.isArray(optionIndexes)
        ? optionIndexes
        : [optionIndexes];

      // Validate option indexes
      if (
        optionsToVote.some(
          (index) => index < 0 || index >= post.poll.options.length
        )
      ) {
        logger.warn(
          `Invalid option index provided by user ${userId} for poll ${postId}.`
        );
        return res
          .status(400)
          .json({ success: false, message: "Invalid poll option" });
      }

      // Check for multi-choice
      if (!post.poll.isMultiChoice && optionsToVote.length > 1) {
        logger.warn(
          `User ${userId} attempted multiple votes in single-choice poll ${postId}.`
        );
        return res
          .status(400)
          .json({
            success: false,
            message: "This poll only allows single choice",
          });
      }

      // Check if user already voted
      const hasVoted = post.poll.options.some((option) =>
        option.voters.some((voter) => voter.toString() === userId.toString())
      );

      if (hasVoted) {
        logger.warn(
          `User ${userId} attempted to vote again in poll ${postId}.`
        );
        return res
          .status(400)
          .json({
            success: false,
            message: "You have already voted in this poll",
          });
      }

      // Add votes
      optionsToVote.forEach((index) => {
        post.poll.options[index].voters.push(userId);
      });

      await post.save();
      logger.info(`User ${userId} successfully voted in poll ${postId}.`);

      // Update cache
      if (typeof PostCache.setPost === "function") {
        await PostCache.setPost(postId, post.toObject());
      }

      res.json({
        success: true,
        message: "Vote recorded successfully",
        poll: post.poll,
      });
    } catch (error) {
      logger.error("Error voting in poll:", error);
      res.status(500).json({
        success: false,
        message: "Failed to record vote",
        error: error.message,
      });
    }
  }

  // Helper method to track post views
  static async trackPostView(postId, userId) {
    try {
      // Find and update the post atomically
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        {
          $inc: { viewCount: 1 },
          $addToSet: { uniqueViewers: userId },
        },
        { new: true, lean: true }
      );

      if (updatedPost) {
        logger.debug(
          `Post ${postId} view tracked for user ${userId}. New view count: ${updatedPost.viewCount}.`
        );
        await trackPostScore(postId, 1); // +1 for view
        if (typeof PostCache.setPost === "function") {
          await PostCache.setPost(postId, updatedPost);
        }
      } else {
        logger.warn(`Attempted to track view for non-existent post: ${postId}`);
      }
    } catch (error) {
      logger.error(
        `Error tracking post view for post ${postId} by user ${userId}:`,
        error
      );
    }
  }
}

module.exports = PostController;
