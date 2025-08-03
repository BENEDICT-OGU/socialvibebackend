const Mission = require('../models/Mission');

exports.checkOrCreateMission = async (userId) => {
  const currentWeek = getWeekNumber();
  const mission = await Mission.findOneAndUpdate(
    { userId, week: currentWeek },
    { $setOnInsert: { type: 'post_count', target: 3 } },
    { new: true, upsert: true }
  );
  return mission;
};

exports.incrementMissionProgress = async (userId, type = 'post_count') => {
  const currentWeek = getWeekNumber();
  const mission = await Mission.findOne({ userId, type, week: currentWeek });

  if (mission && !mission.complete) {
    mission.progress += 1;
    if (mission.progress >= mission.target) {
      mission.complete = true;
      // Optional: reward points
    }
    await mission.save();
  }
};

function getWeekNumber() {
  const now = new Date();
  const firstJan = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((((now - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
}
