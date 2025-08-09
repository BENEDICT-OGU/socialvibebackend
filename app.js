require('dotenv').config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const path = require('path');
const mongoose = require("mongoose");
const redis = require('redis');
const RedisStore = require('connect-redis').default;
const rateLimiter = require('./middleware/rateLimiter');
const ErrorResponse = require("./utils/ErrorResponse");

// Initialize Express app
const app = express();

// ======================
// Redis Configuration
// ======================
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false,
    connectTimeout: 10000,
    reconnectStrategy: (retries) => Math.min(retries * 200, 5000)
  }
});

// Handle Redis connection events
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('🔴 Redis connecting...'));
redisClient.on('ready', () => console.log('✅ Redis connected'));
redisClient.on('reconnecting', () => console.log('🔄 Redis reconnecting'));
redisClient.on('end', () => console.log('🚪 Redis disconnected'));

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err.message);
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Proceeding without Redis (some features degraded)');
    } else {
      process.exit(1);
    }
  }
})();

// ======================
// CORS Configuration
// ======================
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(",") 
  : [process.env.FRONTEND_URL];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new ErrorResponse("Not allowed by CORS", 403));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// ======================
// Middleware Setup
// ======================
app.set('trust proxy', 1); // Important for Render
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session Configuration
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Required for secure cookies on Render
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,
    domain: process.env.NODE_ENV === 'production' 
      ? new URL(process.env.FRONTEND_URL).hostname 
      : undefined
  }
}));

// Rate Limiter (after session middleware)
app.use('/api/', rateLimiter);

// ======================
// Database Connection
// ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ======================
// Passport Configuration
// ======================
require("./config/passport");
app.use(passport.initialize());
app.use(passport.session());

// ======================
// API Routes
// ======================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/posts", require("./routes/posts"));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/trending', require('./routes/trending'));
app.use('/api/recommend', require('./routes/recommend'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use("/api/groq", require("./routes/aiRoutesGroq"));
app.use("/api/threads", require("./routes/chatThreadRoutes"));
app.use('/api/search', require("./routes/search"));
app.use('/api/profile', require('./routes/ProfileRoutes'));
app.use('/api/map', require('./routes/mapRoutes'));

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;