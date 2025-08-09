const { createClient } = require('redis');

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not defined');
}

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false,
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.warn('Max Redis reconnection attempts reached');
        return false;
      }
      return Math.min(retries * 200, 5000);
    }
  }
});

// Enhanced error handling
redisClient.on('error', (err) => {
  if (!['ECONNRESET', 'CONNECTION_BROKEN'].includes(err.code)) {
    console.error('Redis error:', err.message);
  }
});

redisClient.on('ready', () => console.log('✅ Redis connected'));
redisClient.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));
redisClient.on('end', () => console.log('🔴 Redis disconnected'));

// Connect with retries
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('❌ Initial Redis connection failed:', err.message);
    // Don't exit in production - allow fallback to memory
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Proceeding without Redis (some features degraded)');
    } else {
      process.exit(1);
    }
  }
})();

module.exports = redisClient;