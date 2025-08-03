// socialvibe/backend/config/logger.js
const winston = require('winston');
const path = require('path');

// Define log file paths
const logsDir = path.join(__dirname, '../../logs'); // Go up two directories from config/logger.js to backend/logs
const errorLogPath = path.join(logsDir, 'error.log');
const combinedLogPath = path.join(logsDir, 'combined.log');

// Ensure the logs directory exists
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Define the custom format for logs
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Log stack trace for errors
    winston.format.splat(), // Interpolate string arguments
    winston.format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
            // Print error with stack trace
            return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info', // Log 'debug' in dev, 'info' in prod
    format: logFormat,
    transports: [
        // Console transport (for development/real-time monitoring)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // Colorize output for console
                logFormat // Use the custom log format
            ),
            // Only log 'debug' and above to console in development
            level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
        }),
        // File transport for all levels (combined.log)
        new winston.transports.File({ filename: combinedLogPath, level: 'info' }),
        // File transport for error level only (error.log)
        new winston.transports.File({ filename: errorLogPath, level: 'error' })
    ],
    // Exit on error to prevent resource leaks (can be set to false if you want the app to continue)
    exitOnError: false
});

module.exports = logger;