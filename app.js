// app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("passport");
const path = require('path');
const mongoose = require("mongoose");
const ErrorResponse = require("./utils/ErrorResponse");

// Load env vars and Passport config
dotenv.config();
require("./config/passport");

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session & Passport
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('📦 MongoDB connected'))
.catch((err) => console.error('❌ MongoDB error:', err));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/posts", require("./routes/posts"));
app.use('/api/stories', require('./routes/storyRoutes'));
// app.use('/api/reels', require('./routes/reelRoutes')); 
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

// Paystack payment routes
// app.use('/api/payments', require('./routes/paymentRoute'));

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