const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const ChatRoom = require("../models/ChatRoom");
const User = require("../models/User");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const onlineUsers = new Map();
const typingTimers = {};

function socketHandler(io) {
  // Redis adapter setup
  const pubClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
  const subClient = pubClient.duplicate();

  (async () => {
    try {
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("✅ Redis adapter connected");
    } catch (err) {
      console.error("❌ Redis connection error:", err);
    }
  })();

  // Middleware: JWT Auth
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Auth token missing"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error("Authentication failed"));
    }
  });

  // Socket connection
  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);
    onlineUsers.set(socket.userId, socket.id);
    socket.join(socket.userId); // Join personal room for DMs

    socket.on("join_room", ({ roomId }) => {
      socket.join(roomId);
    });

    socket.on("send_message", async ({ roomId, content, type = "text", replyTo = null }) => {
  if (!roomId || !content) return;

  const chatRoom = await ChatRoom.findById(roomId);
  if (!chatRoom) return;

  // ✅ Determine receiver
  const receiverId = chatRoom.participants.find(
    (id) => id.toString() !== socket.userId
  );
  if (!receiverId) return;

  // 🔔 Mention handling
  const mentionedUsernames = content.match(/@(\w+)/g)?.map((u) => u.slice(1)) || [];
  for (const username of mentionedUsernames) {
    const user = await User.findOne({ username });
    if (user) {
      io.to(user._id.toString()).emit("mentioned", {
        from: socket.userId,
        message: content,
      });
    }
  }

  // 📷 Handle content type
  if (type === "image" || type === "video") {
    if (!content.startsWith("/uploads/")) return;
  }

  if (type === "voice") {
    if (!content.startsWith("data:audio/")) return;
  }

  // ✅ Create message with receiver
  const message = await Message.create({
    sender: socket.userId,
    receiver: receiverId,
    roomId,
    content,
    type,
    replyTo,
  });

  chatRoom.lastMessage = message._id;
  await chatRoom.save();

  socket.join(roomId); // Ensure sender is in the room

  const populatedMessage = await message.populate("replyTo");

  io.to(roomId).emit("receive_message", populatedMessage);
});


    socket.on("delete_message", async ({ roomId, messageId }) => {
      const message = await Message.findById(messageId);
      if (!message) return;
      if (message.sender.toString() !== socket.userId) return;

      await message.deleteOne();

      io.to(roomId).emit("message_deleted", { messageId });
    });

    socket.on("edit_message", async ({ roomId, messageId, content }) => {
      const message = await Message.findById(messageId);
      if (!message) return;
      if (message.sender.toString() !== socket.userId) return;

      message.content = content;
      message.edited = true;
      await message.save();

      io.to(roomId).emit("message_edited", { messageId, content });
    });

    socket.on("reaction_added", async ({ messageId, emoji }) => {
      const message = await Message.findById(messageId).populate("reactions.userId", "username");
      if (!message) return;

      const existingReaction = message.reactions.find(
        (r) => r.userId.toString() === socket.userId && r.emoji === emoji
      );
      if (existingReaction) return;

      message.reactions.push({ emoji, userId: socket.userId });
      await message.save();

      io.to(message.roomId.toString()).emit("reaction_added", {
        messageId: message._id,
        emoji,
        userId: socket.userId,
        username: socket.userId, // Replace with actual username if needed
      });
    });

    socket.on("typing", ({ roomId }) => {
      socket.to(roomId).emit("typing", { userId: socket.userId });

      clearTimeout(typingTimers[socket.userId]);
      typingTimers[socket.userId] = setTimeout(() => {
        socket.to(roomId).emit("stop_typing", { userId: socket.userId });
        delete typingTimers[socket.userId];
      }, 4000);
    });

    socket.on("stop_typing", ({ roomId }) => {
      clearTimeout(typingTimers[socket.userId]);
      delete typingTimers[socket.userId];
      socket.to(roomId).emit("stop_typing", { userId: socket.userId });
    });

    socket.on("mark_seen", async ({ messageIds }) => {
      const updates = messageIds.map((id) =>
        Message.findByIdAndUpdate(id, {
          $addToSet: { seenBy: { userId: socket.userId, seenAt: new Date() } },
        })
      );

      await Promise.all(updates);

      messageIds.forEach((id) => {
        io.to(socket.userId).emit("message_seen", {
          messageId: id,
          seenBy: socket.userId,
        });
      });
    });

    socket.on("room_renamed", ({ roomId, name }) => {
      // Handle room rename logic if needed
    });

    socket.on("user_left", ({ userId, roomId }) => {
      // Handle user leaving room
    });

    socket.on("room_deleted", ({ roomId }) => {
      // Handle room deletion
    });

    socket.on("user_joined", ({ userId, roomId }) => {
      // Handle new user joining room
    });

    socket.on("call_initiate", ({ roomId, callType }) => {
      io.to(roomId).emit("call_initiated", { roomId, callType, from: socket.userId });
    });

    socket.on("call_end", ({ roomId }) => {
      io.to(roomId).emit("call_ended", { roomId, from: socket.userId });
    });
  });
}

module.exports = socketHandler;
