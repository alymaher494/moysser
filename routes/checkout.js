const express = require('express');
const router = express.Router();
const EcwidService = require('../services/ecwid.service');
const MoyasarService = require('../services/moyasar.service');
const PayoneService = require('../services/payone.service');
const NoonService = require('../services/noon.service');
const { mapEcwidOrderToPayment } = require('../utils/ecwid-mapper');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const payoneScheduler = require('../services/payone-scheduler.service');

const getEcwidService = () => {
    return new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
};

const getPaymentService = (gateway) => {
    switch (gateway.toLowerCase()) {
        case 'moyasar':
            const apiKey = process.env.MOYASAR_API_KEY_LIVE || process.env.MOYASAR_API_KEY_TEST;
            return new MoyasarService(apiKey);
        case 'payone':
            return new PayoneService();
        case 'noon':
            return new NoonService();
        default:
            throw new NotFoundError(`Gateway '${gateway}' is not supported`);
    }
};

/**
 * Main Checkout Flow
 * Redirects user from Ecwid to the appropriate Payment Gateway
 */
router.get('/:gateway/:orderId', async (req, res) => {
    const { gateway, orderId } = req.params;

    try {
        logger.info(`[Checkout] Starting ${gateway} for Order #${orderId}`);

        // 1. Fetch Order
        const ecwid = getEcwidService();
        const order = await ecwid.getOrder(orderId);

        // 2. Map and Setup Callback
        const paymentData = mapEcwidOrderToPayment(order);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        paymentData.callback_url = `${protocol}://${host}/api/payments/callback/${gateway}?orderId=${orderId}`;

        // 3. Process Gateway
        const paymentService = getPaymentService(gateway);
        const invoice = await paymentService.createInvoice(paymentData);

        if (!invoice.url) {
            throw new Error('Payment gateway failed to provide a redirect URL.');
        }

        // 4. Schedule delayed inquiry for Payone (3-5 min as recommended by Payone support)
        if (gateway.toLowerCase() === 'payone' && invoice.id) {
            payoneScheduler.scheduleInquiry(invoice.id, orderId);
        }

        // 5. Redirect
        logger.info(`[Checkout] Redirecting to: ${invoice.url}`);
        return res.redirect(invoice.url);

    } catch (error) {
        logger.error(`[Checkout] Error (${gateway}):`, error.message);
        return renderErrorPage(res, gateway, error.message);
    }
});

/**
 * Handle success and failure callbacks
 */
router.get('/payment/success', (req, res) => {
    res.send('<h1>✅ تم الدفع بنجاح!</h1><p>شكراً لثقتك بنا. ستصلك رسالة تأكيد قريباً.</p>');
});

router.get('/payment/failure', (req, res) => {
    res.send('<h1>❌ فشلت عملية الدفع</h1><p>يرجى المحاولة مرة أخرى أو اختيار وسيلة دفع مختلفة.</p>');
});

// Backward compatibility (default to Moyasar)
router.get('/:orderId', (req, res) => {
    res.redirect(`/checkout/moyasar/${req.params.orderId}`);
});

/**
 * Professional Error UI
 */
function renderErrorPage(res, gateway, message) {
    res.status(500).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>مشكلة في الدفع</title>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Tajawal', sans-serif; background-color: #0f172a; color: #f8fafc; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
                .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 500px; text-align: center; border: 1px solid #334155; }
                h1 { color: #f87171; margin-bottom: 1rem; }
                p { color: #94a3b8; line-height: 1.6; }
                .retry-btn { display: inline-block; margin-top: 1.5rem; background: #334155; color: white; text-decoration: none; padding: 0.5rem 1.5rem; border-radius: 6px; transition: 0.2s; }
                .retry-btn:hover { background: #475569; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>عذراً، حدث خطأ!</h1>
                <p>واجهنا مشكلة أثناء تحويلك لبوابة الدفع (${gateway}).</p>
                <div style="font-family: monospace; background: #000; padding: 10px; border-radius: 4px; font-size: 0.8em; margin-top: 10px; color: #ef4444;">
                    ${message}
                </div>
                <a href="#" onclick="window.location.reload()" class="retry-btn">إعادة المحاولة</a>
            </div>
        </body>
        </html>
    `);
}

module.exports = router;
