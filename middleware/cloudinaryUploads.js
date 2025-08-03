const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');
const multer = require('multer');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'chat-media',
    allowed_formats: ['jpg', 'png', 'mp4', 'mp3', 'm4a', 'webm'],
    resource_type: 'auto'
  }
});

const upload = multer({ storage });

module.exports = upload;
