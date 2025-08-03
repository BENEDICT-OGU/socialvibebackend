// socialvibe/backend/utils/cache.js
const NodeCache = require('node-cache');
const logger = require('../config/logger'); // Assuming you have a logger

// Initialize NodeCache with a standard TTL (Time To Live)
// stdTTL: default time to live for new keys in seconds. (60 seconds)
// checkperiod: period in seconds to check for expired keys. (120 seconds)
const postCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// General cache functions (from your original file, renamed for clarity)
function get(key) {
    logger.debug(`Cache GET: ${key}`);
    return postCache.get(key);
}

function set(key, value, ttl = 60) { // Added optional TTL for specific caching needs
    logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    postCache.set(key, value, ttl);
}

function del(key) {
    logger.debug(`Cache DEL: ${key}`);
    postCache.del(key);
}

// Specific Post Cache functions for PostController
// This assumes 'post' objects are being stored
function setPost(postId, postData) {
    const key = `post:${postId}`;
    logger.debug(`Caching post: ${postId}`);
    // Cache for 5 minutes (300 seconds) - adjust as needed
    postCache.set(key, postData, 300);
}

function getPost(postId) {
    const key = `post:${postId}`;
    logger.debug(`Retrieving post from cache: ${postId}`);
    return postCache.get(key);
}

function updatePostReactions(postId, newReactions) {
    const key = `post:${postId}`;
    const post = postCache.get(key);
    if (post) {
        post.reactions = newReactions;
        // Re-calculate virtuals if necessary, or ensure the virtuals are computed on retrieval
        // For simplicity, we just update the reactions array here.
        // The virtuals for `reactionCount` and `likeCount` are computed by Mongoose,
        // but since we are caching a plain object (`.lean()` or `.toObject()`),
        // you might need to re-attach or re-calculate them if directly used from cache.
        // For now, assuming the consumer will handle displaying correct counts.
        postCache.set(key, post, postCache.getTtl(key) || 300); // Maintain original TTL or default
        logger.debug(`Updated reactions for cached post: ${postId}`);
    } else {
        logger.warn(`Attempted to update reactions for non-existent cached post: ${postId}`);
    }
}

function deletePost(postId) {
    const key = `post:${postId}`;
    logger.debug(`Deleting post from cache: ${postId}`);
    postCache.del(key);
}

module.exports = {
    get,          // General get
    set,          // General set
    del,          // General delete

    setPost,
    getPost,
    updatePostReactions,
    deletePost
};