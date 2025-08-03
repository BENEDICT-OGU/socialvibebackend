const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String, // 'post_count', 'comment_count', etc.
  target: Number,
  progress: { type: Number, default: 0 },
  complete: { type: Boolean, default: false },
  week: Number
}, { timestamps: true });

module.exports = mongoose.model('Mission', missionSchema);
