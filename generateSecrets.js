const crypto = require('crypto');

function generateBase64Secret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64');
}

function generateHexSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

const secrets = {
  JWT_SECRET: generateHexSecret(),
  SESSION_SECRET: generateHexSecret(),
  REDIS_PASSWORD: generateBase64Secret(24),
  CLOUDINARY_API_SECRET: generateBase64Secret(24),
  OPENAI_API_KEY: 'paste_your_openai_api_key_here',
  LOG_LEVEL: 'info', // or debug, warn, error
  REDIS_PORT: '6379',
  CLOUDINARY_CLOUD_NAME: 'your_cloud_name',
  CLOUDINARY_API_KEY: 'your_cloudinary_api_key',
};

console.log('--- Generated secrets ---');
console.log(secrets);
