// backend/config/redis.js
const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || `redis://localhost:6379`, // include credentials if needed
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
  await redisClient.connect();
})();

module.exports = redisClient;
