// backend/utils/cleanUploads.js
const fs = require('fs');
const path = require('path');

const cleanOldUploads = (directory, maxAgeMinutes = 30) => {
  const uploadPath = path.join(process.cwd(), directory);
  
  if (!fs.existsSync(uploadPath)) return;

  const files = fs.readdirSync(uploadPath);
  const now = new Date().getTime();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  files.forEach(file => {
    const filePath = path.join(uploadPath, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up old file: ${file}`);
    }
  });
};

// Run this periodically (e.g., setInterval or cron job)
cleanOldUploads('public/uploads/avatars');