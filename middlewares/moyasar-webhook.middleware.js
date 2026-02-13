const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Middleware to verify Moyasar Webhook signatures
 */
function verifyMoyasarWebhook(req, res, next) {
    const signature = req.headers['x-moyasar-signature'];
    const webhookSecret = process.env.MOYASAR_WEBHOOK_SECRET;

    // If secret is not configured in environment, reject for security
    if (!webhookSecret) {
        logger.error('Moyasar webhook secret (MOYASAR_WEBHOOK_SECRET) is not configured');
        return res.status(500).send('Webhook verification not configured');
    }

    // If signature is missing, reject
    if (!signature) {
        logger.warn('Moyasar webhook received without signature');
        return res.status(401).send('Missing signature');
    }

    try {
        // Calculate HMAC SHA256 signature
        // Moyasar sends the raw JSON body for signature calculation
        const payload = JSON.stringify(req.body);
        const hmac = crypto.createHmac('sha256', webhookSecret);
        const computedSignature = hmac.update(payload).digest('hex');

        // timing-safe comparison to prevent timing attacks
        const signatureBuffer = Buffer.from(signature, 'utf8');
        const computedBuffer = Buffer.from(computedSignature, 'utf8');

        if (signatureBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, computedBuffer)) {
            logger.warn('Moyasar webhook received with invalid signature');
            return res.status(401).send('Invalid signature');
        }

        // Optional: Check timestamp to prevent replay attacks (if provided by Moyasar)
        const timestamp = req.headers['x-moyasar-timestamp'];
        if (timestamp) {
            const now = Date.now();
            const timeDiff = Math.abs(now - parseInt(timestamp));
            // Reject if request is older than 5 minutes
            if (timeDiff > 5 * 60 * 1000) {
                logger.warn('Moyasar webhook timestamp too old');
                return res.status(401).send('Timestamp too old');
            }
        }

        next();
    } catch (error) {
        logger.error('Error verifying Moyasar webhook signature:', error);
        return res.status(500).send('Verification error');
    }
}

module.exports = verifyMoyasarWebhook;
