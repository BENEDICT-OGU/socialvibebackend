// ✅ routes/chatThreadRoutes.js
const express = require("express");
const router = express.Router();
const ChatThread = require("../models/ChatThread");
const ChatMessage = require("../models/ChatMessage");

// ✅ Create a new thread
router.post("/create", async (req, res) => {
  try {
    const { userId, title } = req.body;
    const thread = await ChatThread.create({ user: userId, title });
    res.status(201).json({ success: true, thread });
  } catch (err) {
    console.error("Create thread error:", err);
    res.status(500).json({ success: false, message: "Failed to create thread" });
  }
});

// ✅ Get all threads for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const threads = await ChatThread.find({ user: req.params.userId }).sort({ updatedAt: -1 });
    res.json({ success: true, threads });
  } catch (err) {
    console.error("Fetch threads error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch threads" });
  }
});

// ✅ Get messages in a thread
router.get("/thread/:threadId", async (req, res) => {
  try {
    const messages = await ChatMessage.find({ threadId: req.params.threadId }).sort("createdAt");
    res.json({ success: true, messages });
  } catch (err) {
    console.error("Fetch thread messages error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
});

// ✅ Delete thread and all messages
router.delete("/thread/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;
    await ChatMessage.deleteMany({ threadId });
    await ChatThread.findByIdAndDelete(threadId);
    res.json({ success: true, message: "Thread and messages deleted" });
  } catch (err) {
    console.error("Delete thread error:", err);
    res.status(500).json({ success: false, message: "Failed to delete thread" });
  }
});

// ✅ Rename thread title
router.patch("/rename/:threadId", async (req, res) => {
  try {
    const { title } = req.body;
    const thread = await ChatThread.findByIdAndUpdate(
      req.params.threadId,
      { title, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ success: true, thread });
  } catch (err) {
    console.error("Rename thread error:", err);
    res.status(500).json({ success: false, message: "Failed to rename thread" });
  }
});

module.exports = router;
