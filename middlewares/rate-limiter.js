const rateLimit = require('express-rate-limit');

/**
 * Rate limiting for payment endpoints to prevent abuse and brute force
 */
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 payment attempts per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        message: 'Too many payment attempts from this IP, please try again after 15 minutes'
    }
});

/**
 * Rate limiting for webhook endpoints
 */
const webhookLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Limit each IP to 50 webhook requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many webhook requests'
    }
});

/**
 * General API rate limiting
 */
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please slow down'
    }
});

module.exports = {
    paymentLimiter,
    webhookLimiter,
    apiLimiter
};
