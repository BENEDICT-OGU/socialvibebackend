const express = require('express');
const { 
  uploadImages,
  deleteImage
} = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../config/upload');

const router = express.Router();

router.route('/images')
  .post(protect, upload.array('images', 5), uploadImages);

router.route('/images/:filename')
  .delete(protect, deleteImage);

module.exports = router;