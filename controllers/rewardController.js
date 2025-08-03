const Reward = require('../models/Reward');
const UserPoints = require('../models/UserPoints');

exports.redeemReward = async (req, res) => {
  const reward = await Reward.findById(req.params.id);
  const user = await UserPoints.findOne({ userId: req.user.id });

  if (!user || user.points < reward.cost) {
    return res.status(400).json({ error: 'Not enough points' });
  }

  user.points -= reward.cost;
  await user.save();

  res.json({ message: `Redeemed ${reward.name}` });
};

exports.getRewards = async (req, res) => {
  const rewards = await Reward.find();
  res.json(rewards);
};
