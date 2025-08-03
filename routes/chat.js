const express = require("express");
const router = express.Router();
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

// 📌 File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// 🧵 Create Group
router.post("/create-group", protect, async (req, res) => {
  const { name, members } = req.body;
  const room = await ChatRoom.create({
    name,
    isGroup: true,
    members: [...members, req.user.id],
    createdBy: req.user.id,
    admins: [req.user.id],
  });
  res.status(201).json(room);
});

// 📩 Send Message
router.post("/:roomId/message", protect, async (req, res) => {
  const { content, type = "text", replyTo = null } = req.body;
  const { roomId } = req.params;

  if (!content) return res.status(400).send("Content required");

  const message = await Message.create({
    sender: req.user.id,
    roomId,
    content,
    type,
    replyTo,
  });

  const chatRoom = await ChatRoom.findById(roomId);
  if (chatRoom) {
    chatRoom.lastMessage = message._id;
    await chatRoom.save();
  }

  const populatedMessage = await message.populate("replyTo");

  const io = req.app.get("io");
  io.to(roomId).emit("receive_message", populatedMessage);

  res.status(201).json(populatedMessage);
});

// 📥 Fetch Messages
router.get("/:roomId/messages", protect, async (req, res) => {
  const { roomId } = req.params;
  const messages = await Message.find({ roomId })
    .populate("replyTo")
    .sort({ timestamp: 1 });

  res.json(messages);
});

// 📎 Upload (image, audio, video)
router.post("/:roomId/upload", protect, upload.single("file"), async (req, res) => {
  const { roomId } = req.params;
  if (!req.file) return res.status(400).send("No file uploaded");

  const fileUrl = `/uploads/${req.file.filename}`;
  const type = req.file.mimetype.startsWith("image/")
    ? "image"
    : req.file.mimetype.startsWith("video/")
    ? "video"
    : req.file.mimetype.startsWith("audio/")
    ? "voice"
    : "file";

  const message = await Message.create({
    sender: req.user.id,
    roomId,
    content: fileUrl,
    type,
  });

  const io = req.app.get("io");
  io.to(roomId).emit("receive_message", {
    ...message.toObject(),
    roomId,
  });

  res.json({ message: "Uploaded", fileUrl, type });
});

// 📌 Pin message
router.post("/:roomId/pin/:messageId", protect, async (req, res) => {
  const room = await ChatRoom.findById(req.params.roomId);
  if (!room) return res.status(404).send("Room not found");

  if (!room.members.includes(req.user.id)) return res.status(403).send("Not a member");

  if (!room.pinnedMessages.includes(req.params.messageId)) {
    room.pinnedMessages.push(req.params.messageId);
    await room.save();

    const io = req.app.get("io");
    io.to(req.params.roomId).emit("message_pinned", {
      roomId: req.params.roomId,
      messageId: req.params.messageId,
    });

    res.json({ message: "Message pinned" });
  } else {
    res.status(400).send("Already pinned");
  }
});

// 🚪 Leave group
router.post("/:roomId/leave", protect, async (req, res) => {
  const room = await ChatRoom.findById(req.params.roomId);
  if (!room) return res.status(404).send("Room not found");

  room.members.pull(req.user.id);
  room.admins.pull(req.user.id);
  room.moderators?.pull(req.user.id);
  await room.save();

  const io = req.app.get("io");
  io.to(req.params.roomId).emit("user_left", {
    userId: req.user.id,
    roomId: req.params.roomId,
  });

  res.json({ message: "You left the group" });
});

// 🗑️ Delete chatroom
router.delete("/:roomId", protect, async (req, res) => {
  const room = await ChatRoom.findById(req.params.roomId);
  if (!room) return res.status(404).send("Not found");

  if (!room.admins.includes(req.user.id) && String(room.createdBy) !== req.user.id) {
    return res.status(403).send("Unauthorized");
  }

  const io = req.app.get("io");
  io.to(req.params.roomId).emit("room_deleted", { roomId: req.params.roomId });

  await Message.deleteMany({ roomId: req.params.roomId });
  await room.deleteOne();

  res.json({ message: "Room deleted" });
});

// 👥 Add member
router.post("/:roomId/add", protect, async (req, res) => {
  const { userId } = req.body;
  const room = await ChatRoom.findById(req.params.roomId);
  if (!room) return res.status(404).send("Not found");

  room.members.addToSet(userId);
  await room.save();

  res.json(room);
});

// ➖ Remove member
router.post("/:roomId/remove", protect, async (req, res) => {
  const { userId } = req.body;
  const room = await ChatRoom.findById(req.params.roomId);
  if (!room) return res.status(404).send("Not found");

  room.members.pull(userId);
  await room.save();

  res.json(room);
});

// 🧾 List user chatrooms
router.get("/my-rooms", protect, async (req, res) => {
  const rooms = await ChatRoom.find({ members: req.user.id })
    .populate("lastMessage")
    .lean();

  const result = await Promise.all(
    rooms.map(async (room) => {
      const unreadCount = await Message.countDocuments({
        roomId: room._id,
        receiver: req.user.id,
        seen: false,
      });
      return { ...room, unreadCount };
    })
  );

  res.json(result);
});

module.exports = router;
