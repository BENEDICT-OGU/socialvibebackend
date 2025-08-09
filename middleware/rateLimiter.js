const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const redisClient = require('../config/redis');

// Main Redis-based rate limiter
const redisLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_', // Distinct prefix for rate limiter keys
  points: 100, // 100 requests
  duration: 60, // per 60 seconds
  blockDuration: 300, // block for 5 minutes if exceeded
  execEvenly: true // smooths out spikes
});

// Memory-based fallback limiter (when Redis fails)
const memoryLimiter = new RateLimiterMemory({
  points: 50, // More restrictive fallback
  duration: 60
});

module.exports = async (req, res, next) => {
  try {
    const key = req.user ? `user_${req.user.id}` : `ip_${req.ip}`;
    
    try {
      // Try Redis first
      await redisLimiter.consume(key);
    } catch (redisErr) {
      if (redisErr instanceof Error) {
        // Redis failed, use memory fallback
        await memoryLimiter.consume(key);
      } else {
        // Redis working but rate limit exceeded
        throw redisErr;
      }
    }

    // Success - add rate limit headers
    const remaining = await redisLimiter.get(key);
    res.set({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': remaining ? remaining.remainingPoints : 'unknown',
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 60
    });
    
    next();
  } catch (err) {
    res.set('Retry-After', String(err.msBeforeNext / 1000));
    res.status(429).json({
      success: false,
      message: `Too many requests. Try again in ${Math.ceil(err.msBeforeNext / 1000)} seconds`
    });
  }
};