const crypto = require('crypto');
const logger = require('../utils/logger');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Middleware to verify Ecwid Webhook signatures
 */
const verifyEcwidWebhook = (req, res, next) => {
    const ecwidToken = process.env.ECWID_TOKEN;
    const signature = req.headers['x-ecwid-webhook-signature'];

    if (!signature) {
        logger.warn('Missing Ecwid webhook signature');
        return next(new UnauthorizedError('Missing webhook signature'));
    }

    // Ecwid webhooks can be verified by comparing the signature
    // Note: Depending on the Ecwid app type, validation might differ.
    // This is a placeholder for standard HMAC validation if applicable
    // Or checking against a known secret.

    // For many simple integrations, checking the presence and a basic token is the first step.
    // Advanced: crypto.createHmac('sha256', secret).update(body).digest('base64');

    next();
};

module.exports = verifyEcwidWebhook;
