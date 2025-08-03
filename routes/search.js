const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");

router.get("/", async (req, res) => {
  const { q: query = "", type = "all" } = req.query;
  const searchType = type.toLowerCase();

  if (!query.trim()) {
    return res.json({ users: [], posts: [], tags: [] });
  }

  try {
    const [users, posts, tags] = await Promise.all([
      // Users search
      searchType === "all" || searchType === "users"
        ? User.find({
            $or: [
              { name: { $regex: query, $options: "i" } },
              { username: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
              { bio: { $regex: query, $options: "i" } },
            ],
            privacySettings: { $ne: "private" },
          })
            .select("_id name username avatar bio")
            .limit(10)
            .lean()
            .then((users) =>
              users.map((user) => ({
                id: user._id.toString(),
                name: user.name || "Unknown User",
                username: user.username || "unknown",
                avatar: user.avatar || "/default-avatar.png",
                bio: user.bio || "",
              }))
            )
        : [],

      // Posts search
      searchType === "all" || searchType === "posts"
        ? Post.find({
            $or: [
              { content: { $regex: query, $options: "i" } },
              { hashtags: { $regex: query, $options: "i" } },
            ],
            privacy: "public",
          })
            .populate("user", "name username avatar")
            .select("content media reactions createdAt hashtags user")
            .limit(10)
            .lean()
            .then((posts) =>
              posts.map((post) => ({
                ...post,
                id: post._id.toString(),
                author: {
                  id: post.user?._id?.toString() || "unknown",
                  name: post.user?.name || "Unknown User",
                  username: post.user?.username || "unknown",
                  avatar: post.user?.avatar || "/default-avatar.png",
                },
                likesCount: post.reactions?.length || 0,
                commentsCount: post.comments?.length || 0,
                sharesCount: post.sharesCount || 0,
              }))
            )
        : [],

      // Tags search
      searchType === "all" || searchType === "tags"
        ? Post.aggregate([
            { $match: { hashtags: { $regex: query, $options: "i" } } },
            { $unwind: "$hashtags" },
            { $match: { hashtags: { $regex: query, $options: "i" } } },
            { $group: { _id: "$hashtags", count: { $sum: 1 } } },
            { $project: { name: "$_id", postCount: "$count", _id: 0 } },
            { $limit: 10 },
          ])
        : [],
    ]);

    res.json({
      users: users || [],
      posts: posts || [],
      tags: tags || [],
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

module.exports = router;
