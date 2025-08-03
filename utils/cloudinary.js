// backend/utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (filePath, options = {}) => {
  let absolutePath;
  
  try {
    // Resolve to absolute path to avoid any relative path issues
    absolutePath = path.resolve(filePath);
    
    // Verify file exists before attempting upload
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found at path: ${absolutePath}`);
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(absolutePath, options);
    
    // Only attempt deletion if file exists
    if (fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (deleteError) {
        console.error(`Warning: Could not delete temporary file: ${deleteError.message}`);
        // This isn't a fatal error, so we continue
      }
    }

    return result;
    
  } catch (error) {
    // Attempt to clean up file if it exists
    if (absolutePath && fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (cleanupError) {
        console.error(`Error during cleanup: ${cleanupError.message}`);
      }
    }
    
    // Enhance the error message
    if (error.message.includes('File not found')) {
      throw new Error(`Upload failed: ${error.message}`);
    } else if (error.message.includes('Invalid Signature')) {
      throw new Error('Cloudinary authentication failed - check your API credentials');
    } else {
      throw new Error(`Cloudinary upload error: ${error.message}`);
    }
  }
};

module.exports = { uploadToCloudinary };