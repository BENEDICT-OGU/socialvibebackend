const redisClient = require("../config/redis");

const cacheMiddleware = (duration) => {
  return async (req, res, next) => {
    // Skip cache for authenticated users or POST/PUT/DELETE requests
    if (req.user || !["GET", "HEAD"].includes(req.method)) {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(key);

      if (cachedData) {
        const result = JSON.parse(cachedData);
        return res.json({
          ...result,
          _cached: true,
          _expiresIn: duration,
        });
      }

      // Override res.json to cache responses
      const originalJson = res.json;
      res.json = (body) => {
        redisClient
          .setEx(key, duration, JSON.stringify(body))
          .catch((err) => console.error("Redis cache set error:", err));
        originalJson.call(res, body);
      };

      next();
    } catch (err) {
      console.error("Cache middleware error:", err);
      next(); // Continue without caching if error occurs
    }
  };
};

module.exports = cacheMiddleware;
