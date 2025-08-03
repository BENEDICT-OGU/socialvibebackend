const mongoose = require('mongoose');

const userPointsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  points: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  lastCheckIn: { type: Date },
  streak: { type: Number, default: 0 },
  badges: [String]
}, { timestamps: true });

module.exports = mongoose.model('UserPoints', userPointsSchema);
