const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: {
      servername: 'right-grubworm-35059.upstash.io', // Critical for Upstash
      rejectUnauthorized: false
    },
    connectTimeout: 20000, // Increase to 20 seconds
    reconnectStrategy: (retries) => {
      if (retries > 3) return new Error('Max retries reached');
      return 1000; // Retry every 1 second
    }
  }
});

// Quieter error handling
redisClient.on('error', (err) => {
  if (!['ECONNRESET', 'CONNECTION_TIMEOUT'].includes(err.code)) {
    console.error('Redis:', err.message);
  }
});

redisClient.on('ready', () => console.log('Redis: Ready ✅'));

// Connection wrapper
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Initial Redis connection failed:', err.message);
  }
})();

module.exports = redisClient;