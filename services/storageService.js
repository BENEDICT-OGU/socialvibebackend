const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (make sure these match your Cloudinary dashboard)
console.log('Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  // Don't log the secret for security
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
const generateSignedUrl = async (filePath) => {
  try {
    console.log(`Uploading ${filePath} to Cloudinary...`);
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
      folder: "socialvibe_posts"
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload failed:', {
      error: error.message,
      stack: error.stack
    });
    throw new Error('Failed to upload media');
  }
};

const deleteFileFromStorage = async (url) => {
  try {
    const publicId = url.split('/').pop().split('.')[0];
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

module.exports = { generateSignedUrl, deleteFileFromStorage };