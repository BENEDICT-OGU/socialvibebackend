const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");

// PATCH: Edit message
router.patch("/:messageId/edit", protect, async (req, res) => {
  const { content } = req.body;
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).send("Message not found");

  if (!message.sender.equals(req.user.id))
    return res.status(403).send("Unauthorized");

  message.content = content;
  message.edited = true;
  message.editedAt = new Date();
  await message.save();

  const io = req.app.get("io");
  io.to(message.roomId.toString()).emit("message_edited", {
    messageId: message._id,
    content,
    editedAt: message.editedAt,
  });

  res.json({ message: "Message updated" });
});

// DELETE: Remove message
router.delete("/:messageId", protect, async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).send("Message not found");

  if (!message.sender.equals(req.user.id))
    return res.status(403).send("Unauthorized");

  await message.deleteOne();

  const io = req.app.get("io");
  io.to(message.roomId.toString()).emit("message_deleted", {
    messageId: message._id,
  });

  res.json({ message: "Message deleted" });
});

// POST: React to message
router.post("/:messageId/react", protect, async (req, res) => {
  const { emoji } = req.body;
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).send("Message not found");

  const existing = message.reactions.find(
    (r) => r.userId.equals(req.user.id) && r.emoji === emoji
  );
  if (existing) return res.status(400).send("Already reacted");

  message.reactions.push({ emoji, userId: req.user.id });
  await message.save();

  const io = req.app.get("io");
  io.to(message.roomId.toString()).emit("reaction_added", {
    messageId: message._id,
    emoji,
    userId: req.user.id,
  });

  res.json({ message: "Reaction added" });
});



router.get('/:userId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
