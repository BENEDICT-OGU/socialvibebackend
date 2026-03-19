require('dotenv').config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const redis = require('redis');
const { createClient } = redis;
const { default: RedisStore } = require('connect-redis'); // Correct import
const rateLimiter = require('./middleware/rateLimiter');

// Initialize Express
const app = express();

// ======================
// Redis Client Setup
// ======================
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false,
    connectTimeout: 10000
  }
});

// Redis connection events
redisClient.on('error', (err) => console.error('Redis Error:', err));
redisClient.on('connect', () => console.log('Redis connecting...'));
redisClient.on('ready', () => console.log('✅ Redis connected'));
redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));
redisClient.on('end', () => console.log('Redis disconnected'));

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('❌ Redis connection failed:', err);
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Continuing without Redis (some features degraded)');
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
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// ======================
// Middleware Setup
// ======================
app.set('trust proxy', 1); // Required for Render
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
const sessionConfig = {
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Required for Render
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
};

app.use(session(sessionConfig));

// Rate Limiter
app.use('/api/', rateLimiter);

// ======================
// Database Connection
// ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// ======================
// Passport Setup
// ======================
require("./config/passport");
app.use(passport.initialize());
app.use(passport.session());

// ======================
// API Routes (Keep your existing routes)
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
    message: err.message || 'Internal Server Error' 
  });
});

module.exports = app;