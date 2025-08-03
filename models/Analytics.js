const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  type: { type: String, enum: ['view', 'like', 'comment', 'share', 'visit', 'watch'], required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: Object }
});

module.exports = mongoose.model('Analytics', analyticsSchema);
