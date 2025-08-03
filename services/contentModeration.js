// socialvibe/backend/services/contentModeration.js
const logger = require('../config/logger'); // Assuming your logger is set up

// --- Configuration for Banned Words and Phrases ---
// You can make this dynamic by fetching from a database or a separate config file
// For now, it's hardcoded for simplicity.
const BANNED_WORDS = [
    'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'nigger', 'faggot', 'porn',
    'sex', 'dick', 'pussy', 'whore', 'slut', 'bastard', 'hell', 'damn',
    // Add more as needed. Consider variations (e.g., f.u.c.k, s.h.i.t)
];

// Regex to find banned words, case-insensitive, whole word match
const bannedWordsRegex = new RegExp(
    `\\b(${BANNED_WORDS.join('|')})\\b`, 'gi'
);

// --- Content Moderation Functions ---

/**
 * Filters sensitive content from a given text by replacing banned words with asterisks.
 * Also checks if the content should be blocked entirely based on severe violations.
 *
 * @param {string} text - The input text to moderate.
 * @returns {object} An object containing:
 * - `filteredContent`: The text with banned words replaced.
 * - `isBlocked`: A boolean indicating if the content should be entirely blocked.
 * - `reasons`: An array of strings explaining why it might be blocked.
 */
async function filterSensitiveContent(text) {
    if (!text || typeof text !== 'string') {
        return { filteredContent: text, isBlocked: false, reasons: [] };
    }

    let filtered = text;
    let detectedWords = [];
    let isBlocked = false;
    let reasons = [];

    // Detect and replace banned words
    filtered = filtered.replace(bannedWordsRegex, (match) => {
        detectedWords.push(match.toLowerCase());
        return '*'.repeat(match.length); // Replace with asterisks
    });

    // Determine if content should be blocked (e.g., if highly offensive words are present)
    // This is a simple example; a real system might use AI/ML or more complex rules.
    const severeWordsDetected = detectedWords.filter(word =>
        ['nigger', 'faggot', 'cunt', 'child porn'].includes(word) // Add highly offensive words here
    );

    if (severeWordsDetected.length > 0) {
        isBlocked = true;
        reasons.push(`Contains severely inappropriate language: ${[...new Set(severeWordsDetected)].join(', ')}`);
        logger.warn(`Content blocked due to severe language from user: ${text.substring(0, 50)}...`);
    } else if (detectedWords.length > 0) {
        // Content might not be blocked, but just filtered
        reasons.push(`Contains filtered inappropriate language: ${[...new Set(detectedWords)].join(', ')}`);
        logger.info(`Content filtered: ${text.substring(0, 50)}... -> ${filtered.substring(0, 50)}...`);
    }

    return {
        filteredContent: filtered,
        isBlocked,
        reasons
    };
}

/**
 * Detects if a given text contains any banned words.
 *
 * @param {string} text - The input text to check.
 * @returns {array} An array of unique banned words found in the text (lowercase).
 */
async function detectBannedWords(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const foundWords = [];
    const matches = text.match(bannedWordsRegex);
    if (matches) {
        matches.forEach(match => foundWords.push(match.toLowerCase()));
    }

    logger.debug(`Detected banned words in text: ${[...new Set(foundWords)].join(', ')}`);
    return [...new Set(foundWords)]; // Return unique words
}

module.exports = {
    filterSensitiveContent,
    detectBannedWords
};