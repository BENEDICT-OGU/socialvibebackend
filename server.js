const http = require('http');
const socketIO = require('socket.io');
const app = require('./app');
const socketHandler = require("./socket/socket");

const server = http.createServer(app);

// Socket.IO with Redis adapter
const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('./config/redis');

const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});

// Initialize adapter after connections
const initSocketAdapter = async () => {
  try {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('PubSub: Active');
  } catch (err) {
    console.log('PubSub: Using fallback (Redis not available)');
  }
};

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
  await initSocketAdapter();
});

// Cleanup on exit
process.on('SIGTERM', () => {
  io.close();
  server.close();
});