const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const redisClient = require("./config/redis");
const rateLimiter = require('./middleware/rateLimiter');

// Load env vars and Passport config
dotenv.config();
require("./config/passport");

const app = express();

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS.split(",") || [process.env.FRONTEND_URL];
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

// Session configuration with Redis store
const RedisStore = require('connect-redis').default;
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Rate limiting (applied after session middleware)
app.use('/api/', rateLimiter);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// Routes (unchanged from your original)
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

// ... (all other routes remain the same)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error' 
  });
});

module.exports = app;