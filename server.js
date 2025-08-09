require('dotenv').config();
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const redisClient = require('./config/redis');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL.split(','),
    credentials: true
  }
});

// Initialize Socket.IO Redis adapter (with fallback)
const initializeRedisAdapter = async () => {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis adapter initialized');
  } catch (err) {
    console.warn('❌ Redis adapter disabled - using memory fallback:', err.message);
  }
};

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initializeRedisAdapter();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔴 Shutting down gracefully...');
  httpServer.close(async () => {
    await redisClient.quit().catch(() => {});
    process.exit(0);
  });
});