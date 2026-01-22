/**
 * Simple Logger Utility
 * In production, it logs JSON. In development, it logs formatted text.
 */

const levels = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
};

const log = (level, message, meta = {}) => {
    const isProd = process.env.NODE_ENV === 'production';
    const timestamp = new Date().toISOString();

    if (isProd) {
        console.log(JSON.stringify({ timestamp, level, message, ...meta }));
    } else {
        const color = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[32m',  // Green
            debug: '\x1b[34m', // Blue
        }[level] || '';
        const reset = '\x1b[0m';

        console.log(`${color}[${timestamp}] ${level.toUpperCase()}:${reset} ${message}`, Object.keys(meta).length ? meta : '');
    }
};

module.exports = {
    info: (msg, meta) => log(levels.INFO, msg, meta),
    error: (msg, meta) => log(levels.ERROR, msg, meta),
    warn: (msg, meta) => log(levels.WARN, msg, meta),
    debug: (msg, meta) => log(levels.DEBUG, msg, meta),
};
