const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("passport");
const path = require('path');
const mongoose = require("mongoose");
const ErrorResponse = require("./utils/ErrorResponse");
const redis = require('redis');
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');
const rateLimiter = require('./middleware/rateLimiter');

// Load env vars and Passport config
dotenv.config();
require("./config/passport");

const app = express();

// Create Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
});

redisClient.connect().catch(console.error);

// CORS configuration
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
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimiter);

// Session configuration with Redis store
// Replace your current session setup with:
app.use(session({
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:', // Optional key prefix
    ttl: 86400 // Session TTL in seconds (24h)
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Rate limiter

app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) return next(); // Skip for auth routes
  rateLimiter(req, res, next);
});
// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('📦 MongoDB connected'))
.catch((err) => console.error('❌ MongoDB error:', err));


app.get('/redis-health', async (req, res) => {
  try {
    const ping = await redisClient.ping();
    const uptime = await redisClient.sendCommand(['INFO', 'uptime_in_seconds']);
    res.json({
      status: ping === 'PONG' ? 'healthy' : 'degraded',
      uptime: uptime.split('\n')[0].split(':')[1].trim()
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});


// Static files
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Routes
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

// Test route
app.get("/", (req, res) => {
  res.send("Welcome to Socialvibe API!");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error' 
  });
});

module.exports = app;