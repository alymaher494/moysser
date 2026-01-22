const { UnauthorizedError } = require('../utils/errors');

/**
 * Basic Authentication Middleware
 * Checks for X-API-KEY header
 */
const apiAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.APP_API_KEY || 'secret-api-key';

    // In production, always require the key
    if (process.env.NODE_ENV === 'production' || apiKey) {
        if (apiKey !== validApiKey) {
            return next(new UnauthorizedError('Invalid API Key'));
        }
    }

    next();
};

module.exports = apiAuth;
