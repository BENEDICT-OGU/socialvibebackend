// backend/config/redis.js
const { createClient } = require('redis');
const logger = require('./logger'); // Make sure you have a logger setup

class RedisManager {
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'rediss://default:AYjzAAIjcDEyOTE4MTNjZWRiN2I0MDc2YTdiYmI2M2I4YTExMDg2N3AxMA@right-grubworm-35059.upstash.io:6379',
      socket: {
        tls: true,
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 100, 5000);
          logger.warn(`Redis connection lost. Retry #${retries} in ${delay}ms`);
          return delay;
        },
        connectTimeout: 10000
      }
    });

    this.setupEventListeners();
    this.connect();
  }

  setupEventListeners() {
    this.client.on('connect', () => logger.info('Redis connecting...'));
    this.client.on('ready', () => logger.info('Redis connected and ready'));
    this.client.on('error', (err) => {
      logger.error(`Redis error: ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
        logger.error('Connection refused - check credentials/network');
      }
    });
    this.client.on('reconnecting', () => logger.warn('Redis reconnecting...'));
    this.client.on('end', () => logger.warn('Redis connection closed'));
  }

  async connect() {
    try {
      await this.client.connect();
      
      // Verify connection
      const ping = await this.client.ping();
      if (ping !== 'PONG') throw new Error('Invalid PING response');
      
      logger.info('Redis connection verified');
    } catch (err) {
      logger.error('Redis connection failed:', err);
      process.exit(1); // Fail fast in production
    }
  }

  async disconnect() {
    try {
      await this.client.quit();
      logger.info('Redis disconnected gracefully');
    } catch (err) {
      logger.error('Error disconnecting Redis:', err);
    }
  }

  // Singleton pattern
  static getInstance() {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await RedisManager.getInstance().disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await RedisManager.getInstance().disconnect();
  process.exit(0);
});

module.exports = RedisManager.getInstance().client;