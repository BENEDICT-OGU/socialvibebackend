// socialvibe/backend/utils/trending.js
const Hashtag = require('../models/Hashtag'); // Import the new Hashtag model
const logger = require('../config/logger'); // Assuming your logger is set up

/**
 * Tracks a hashtag's usage count and last used timestamp.
 * If the hashtag doesn't exist, it creates it.
 * @param {string} tag - The hashtag text (e.g., "travel")
 */
async function trackHashtag(tag) {
    try {
        const normalizedTag = tag.toLowerCase().trim(); // Ensure consistency

        // Find the hashtag and increment its count, or create it if it doesn't exist
        const updatedHashtag = await Hashtag.findOneAndUpdate(
            { tag: normalizedTag },
            { $inc: { count: 1 }, $set: { lastUsed: new Date() } }, // Increment count, update last used
            { upsert: true, new: true, setDefaultsOnInsert: true } // upsert: create if not found, new: return updated doc
        );
        logger.debug(`Hashtag tracked: ${normalizedTag}, new count: ${updatedHashtag.count}`);
        return updatedHashtag;
    } catch (error) {
        logger.error(`Error tracking hashtag '${tag}':`, error);
        // Don't re-throw, as failing to track a hashtag shouldn't break the main post creation
        return null;
    }
}

/**
 * Placeholder for tracking post scores for trending algorithm.
 * You'll develop a more complex trending algorithm later.
 * For now, it just logs.
 * @param {string} postId - The ID of the post.
 * @param {number} scoreIncrease - The points to add for trending calculation (e.g., 1 for a view, 5 for a like).
 */
async function trackPostScore(postId, scoreIncrease) {
    logger.debug(`Tracking score for post ${postId}: +${scoreIncrease} points.`);
    // In a real scenario, you would update a 'trending score' on the post
    // or in a separate trending collection/cache.
    // e.g., await Post.findByIdAndUpdate(postId, { $inc: { trendingScore: scoreIncrease } });
}

/**
 * Placeholder for calculating and retrieving trending content.
 * You would implement the actual algorithm here.
 */
async function calculateTrendingScore() {
    logger.info('Calculating trending scores...');
    // This function would contain your logic to aggregate scores from posts, hashtags,
    // and other interactions to determine what's currently trending.
    // For hashtags, you might query them, sort by 'count' and 'lastUsed'.
    try {
        const trendingHashtags = await Hashtag.find()
            .sort({ lastUsed: -1, count: -1 }) // Sort by most recently used, then by count
            .limit(10) // Get top 10 trending hashtags
            .lean(); // Return plain JavaScript objects
        return trendingHashtags;
    } catch (error) {
        logger.error('Error calculating trending hashtags:', error);
        return [];
    }
}

module.exports = {
    trackHashtag,
    trackPostScore,
    calculateTrendingScore
};