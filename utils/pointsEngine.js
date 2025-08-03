// socialvibe/backend/utils/pointsEngine.js
const User = require('../models/User'); // We'll need to update the User model
const logger = require('../config/logger');

// Define point values for different actions
const POINTS_CONFIG = {
    'create_post': 10,
    'like_post': 2,
    'comment_on_post': 5,
    'receive_like_on_post': 3,
    'receive_comment_on_post': 4,
    'follow_user': 3,
    'be_followed': 5,
    'login_daily': 1, // Example for daily login bonus
    'profile_completion': 20, // Example for one-time bonus
    'delete_post': -5, // Deduct points for deleting a post
    'unlike_post': -2 // Deduct points for unliking a post
    // Add more actions and their corresponding points as your app grows
};

/**
 * Adds points to a user's total based on an action type.
 * @param {string} userId - The ID of the user.
 * @param {string} actionType - The type of action performed (e.g., 'create_post').
 * @returns {Promise<User|null>} The updated user document or null if an error occurred.
 */
async function addPoints(userId, actionType) {
    const pointsToAdd = POINTS_CONFIG[actionType] || 0; // Get points for action, default to 0
    if (pointsToAdd === 0) {
        logger.warn(`No points configured for actionType: ${actionType}`);
        return null;
    }

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: { points: pointsToAdd } }, // Increment points
            { new: true, runValidators: true } // Return the updated document, run schema validators
        );

        if (user) {
            logger.info(`Added ${pointsToAdd} points to user ${userId} for action '${actionType}'. New total: ${user.points}`);
        } else {
            logger.warn(`User ${userId} not found when trying to add points for action '${actionType}'.`);
        }
        return user;
    } catch (error) {
        logger.error(`Error adding points to user ${userId} for action '${actionType}':`, error);
        return null;
    }
}

/**
 * Deducts points from a user's total based on an action type.
 * Ensures points do not go below zero.
 * @param {string} userId - The ID of the user.
 * @param {string} actionType - The type of action performed (e.g., 'delete_post').
 * @returns {Promise<User|null>} The updated user document or null if an error occurred.
 */
async function deductPoints(userId, actionType) {
    const pointsToDeduct = POINTS_CONFIG[actionType] || 0;
    if (pointsToDeduct === 0) {
        logger.warn(`No deduction points configured for actionType: ${actionType}`);
        return null;
    }

    try {
        // Use findById and save to handle ensuring points don't go below 0
        const user = await User.findById(userId);
        if (!user) {
            logger.warn(`User ${userId} not found when trying to deduct points for action '${actionType}'.`);
            return null;
        }

        user.points = Math.max(0, user.points - pointsToDeduct); // Ensure points don't go below 0
        await user.save();

        logger.info(`Deducted ${pointsToDeduct} points from user ${userId} for action '${actionType}'. New total: ${user.points}`);
        return user;
    } catch (error) {
        logger.error(`Error deducting points from user ${userId} for action '${actionType}':`, error);
        return null;
    }
}

module.exports = {
    addPoints,
    deductPoints
};