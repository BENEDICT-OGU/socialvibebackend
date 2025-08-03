const express = require('express');
const multer = require('multer');
const {protect} = require('../middleware/auth');
const router = express.Router();
const {upload} = require('../middleware/cloudinaryUpload');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/chat/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

// router.post('/chat', auth, upload.single('media'), (req, res) => {
//   res.json({ url: `/uploads/chat/${req.file.filename}` });
// });
// POST /api/upload/chat
router.post('/chat', protect, upload.single('media'), (req, res) => {
    res.json({ url: req.file.path, type: req.file.mimetype });
  });

module.exports = router;
