const Post = require("../models/Post");
const User = require("../models/User");

// Share a post with selected users
exports.sharePost = async (req, res) => {
  try {
    const { postId, userIds } = req.body; // userIds: array of user IDs to share with
    const senderId = req.user._id;

    if (!postId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "Post ID and user IDs are required" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // For simplicity, create a notification or message for each user
    // Here, just simulate sharing by logging or storing share info
    // You can extend this to create notifications or messages in your app

    // Example: Add postId to each user's sharedPosts array (you may need to add this field)
    await Promise.all(userIds.map(async (userId) => {
      const user = await User.findById(userId);
      if (user) {
        // For now, just log sharing action
        console.log(`User ${senderId} shared post ${postId} with user ${userId}`);
        // TODO: Implement actual sharing logic like notifications or messages
      }
    }));

    res.json({ message: "Post shared successfully" });
  } catch (error) {
    console.error("Error sharing post:", error);
    res.status(500).json({ message: "Server error" });
  }
};
