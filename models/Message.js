const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: { type: String, required: true },
  type: { type: String, enum: ["text", "image", "voice"], default: "text" },
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom" },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  reactions: [
    {
      emoji: String,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  ],
  edited: { type: Boolean, default: false },
  editedAt: { type: Date },
  seenBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    seenAt: Date
  }]
  
});

module.exports = mongoose.model("Message", messageSchema);
