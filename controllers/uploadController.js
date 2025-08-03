const path = require('path');
const fs = require('fs');

// @desc    Upload images
// @route   POST /api/upload/images
// @access  Private
exports.uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Please upload files' });
    }

    const fileUrls = req.files.map(file => {
      return {
        url: `/uploads/${file.filename}`
      };
    });

    res.status(200).json({
      success: true,
      data: fileUrls
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete image
// @route   DELETE /api/upload/images/:filename
// @access  Private
exports.deleteImage = async (req, res, next) => {
  try {
    const filePath = path.join(__dirname, '../uploads', req.params.filename);

    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(404).json({ message: 'File not found' });
      }

      res.status(200).json({
        success: true,
        data: {}
      });
    });
  } catch (err) {
    next(err);
  }
};