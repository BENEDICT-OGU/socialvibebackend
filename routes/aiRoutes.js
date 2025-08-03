// ✅ routes/aiRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const ChatMessage = require("../models/ChatMessage");
require("dotenv").config();

router.post("/chat", async (req, res) => {
  const { prompt, history = [], userId, threadId } = req.body;

  if (!prompt || !userId || !threadId) {
    return res.status(400).json({ error: "Prompt, userId, and threadId are required." });
  }

  try {
    const messages = [
      { role: "system", content: "You are a helpful, friendly, and concise AI assistant." },
      ...history,
      { role: "user", content: prompt }
    ];

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // Save user message
    await ChatMessage.create({ user: userId, role: "user", content: prompt, threadId });

    // Save assistant reply
    await ChatMessage.create({ user: userId, role: "assistant", content: aiReply, threadId });

    res.json({ reply: aiReply });
  } catch (error) {
    console.error("OpenAI error:", error.response?.data || error.message);
    res.status(500).json({ error: "AI assistant failed to respond" });
  }
});

router.get("/history/:threadId", async (req, res) => {
  try {
    const messages = await ChatMessage.find({ threadId: req.params.threadId })
      .sort("createdAt")
      .select("role content createdAt");
    res.json({ success: true, messages });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
});

module.exports = router;
