// server.js
const http = require('http');
const socketIO = require('socket.io');
const app = require('./app');
const socketHandler = require("./socket/socket");
const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('./config/redis');
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

const server = http.createServer(app);

// Initialize socket.io
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST'],
  }
});
app.set('io', io);
socketHandler(io);


Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('Socket.IO Redis adapter initialized');
});


// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
});