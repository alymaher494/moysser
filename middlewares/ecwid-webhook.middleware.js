const crypto = require('crypto');
const logger = require('../utils/logger');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Middleware to verify Ecwid Webhook signatures
 */
const verifyEcwidWebhook = (req, res, next) => {
    const webhookSecret = process.env.ECWID_WEBHOOK_SECRET || process.env.ECWID_TOKEN;
    const clientSignature = req.headers['x-ecwid-webhook-signature'];

    if (!webhookSecret) {
        logger.error('Ecwid webhook secret is not configured');
        return res.status(500).send('Webhook verification not configured');
    }

    if (!clientSignature) {
        logger.warn('Missing Ecwid webhook signature');
        return next(new UnauthorizedError('Missing webhook signature'));
    }

    try {
        // Ecwid uses HMAC SHA256 of the raw body
        // Note: For Ecwid, the signature is often hex encoded
        const payload = JSON.stringify(req.body);
        const hmac = crypto.createHmac('sha256', webhookSecret);
        const computedSignature = hmac.update(payload).digest('hex');

        if (clientSignature !== computedSignature) {
            logger.warn('Ecwid webhook invalid signature');
            return next(new UnauthorizedError('Invalid webhook signature'));
        }

        next();
    } catch (error) {
        logger.error('Error verifying Ecwid webhook signature:', error);
        return res.status(500).send('Verification error');
    }
};

module.exports = verifyEcwidWebhook;

