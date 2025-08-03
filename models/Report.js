// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: false },
  reportedComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: false },
  reason: String,
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);