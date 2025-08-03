const express = require("express");
const router = express.Router();
const axios = require("axios");
const ChatMessage = require("../models/ChatMessage");
const ChatThread = require("../models/ChatThread");
require("dotenv").config();

// POST /api/groq/chat
router.post("/chat", async (req, res) => {
  let { prompt, history = [], userId, threadId } = req.body;

  if (!prompt || !userId) {
    return res.status(400).json({ error: "Prompt and userId are required." });
  }

  try {
    // If no threadId is passed, create a new thread
    if (!threadId) {
      const newThread = await ChatThread.create({ user: userId });
      threadId = newThread._id;
    }

    const messages = [
      { role: "system", content: "You are a helpful, friendly, and concise AI assistant that responds like a classy modern chatbot." },
      ...history,
      { role: "user", content: prompt }
    ];

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages,
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // Save user and assistant messages
    await ChatMessage.insertMany([
      { user: userId, role: "user", content: prompt, threadId },
      { user: userId, role: "assistant", content: aiReply, threadId }
    ]);

    res.json({ success: true, reply: aiReply, threadId });
  } catch (error) {
    console.error("Groq AI error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to get response from Groq AI." });
  }
});

// GET /api/groq/history/:threadId
router.get("/history/:threadId", async (req, res) => {
  try {
    const messages = await ChatMessage.find({ threadId: req.params.threadId })
      .sort("createdAt")
      .select("role content createdAt");

    res.json({ success: true, messages });
  } catch (err) {
    console.error("Fetch chat history error:", err);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
});

module.exports = router;
