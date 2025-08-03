const Story = require('../models/Story');

exports.uploadStory = async (req, res) => {
  const userId = req.user.id;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
  const mediaUrl = `/uploads/stories/${file.filename}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const story = await Story.create({
      userId,
      mediaUrl,
      mediaType,
      expiresAt
    });
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ error: 'Story upload failed' });
  }
};

exports.getUserStories = async (req, res) => {
  const { userId } = req.params;

  try {
    const stories = await Story.find({
      userId,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
};
