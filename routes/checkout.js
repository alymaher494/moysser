const express = require('express');
const router = express.Router();
const EcwidService = require('../services/ecwid.service');
const MoyasarService = require('../services/moyasar.service');
const PayoneService = require('../services/payone.service');
const NoonService = require('../services/noon.service');
const { mapEcwidOrderToPayment } = require('../utils/ecwid-mapper');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

const getEcwidService = () => {
    return new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
};

const getPaymentService = (gateway) => {
    switch (gateway.toLowerCase()) {
        case 'moyasar':
            const apiKey = process.env.MOYASAR_API_KEY_LIVE || process.env.MOYASAR_API_KEY_TEST;
            return new MoyasarService(apiKey);
        case 'payone':
            return new PayoneService(); // Payone uses env vars internally in this version
        case 'noon':
            return new NoonService();
        default:
            throw new NotFoundError(`Gateway '${gateway}' is not supported`);
    }
};

/**
 * Checkout Flow Routes
 */

// Universal Landing page for checkout redirection
// Route: /checkout/:gateway/:orderId
router.get('/:gateway/:orderId', async (req, res) => {
    const { gateway, orderId } = req.params;

    try {
        logger.info(`Processing ${gateway} checkout for Order #${orderId}`);

        // 1. Get order from Ecwid
        const ecwid = getEcwidService();
        const order = await ecwid.getOrder(orderId);

        // 2. Map Ecwid order to Payment data (Generic mapping)
        const paymentData = mapEcwidOrderToPayment(order);

        // 3. Add callback URL dynamically
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        // Callback needs to know which gateway to verify against
        paymentData.callback_url = `${protocol}://${host}/api/payments/callback/${gateway}?orderId=${orderId}`;

        // 4. Initialize the selected Gateway Service
        const paymentService = getPaymentService(gateway);

        let redirectUrl;

        // 5. Create Invoice/Payment based on gateway
        const invoice = await paymentService.createInvoice(paymentData);
        redirectUrl = invoice.url;

        if (!redirectUrl) {
            throw new Error('Failed to generate payment URL. Response: ' + JSON.stringify(invoice));
        }

        // 6. Redirect user
        logger.info(`Redirecting user to ${gateway} Invoice: ${redirectUrl}`);
        return res.redirect(redirectUrl);

    } catch (error) {
        logger.error(`${gateway} Checkout error for Order #${orderId}:`, error);

        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>خطأ في التجهيز</title>
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Tajawal', sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
                    .error-container { background: rgba(255, 255, 255, 0.05); padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.2); }
                    h1 { color: #ef4444; }
                    a { color: #2563eb; text-decoration: none; margin-top: 1rem; display: block; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>حدث خطأ أثناء تجهيز الدفع (${gateway}) <small style="font-size:0.5em; opacity:0.5;">v:fixed-api-v10</small></h1>
                    <div style="direction: ltr; text-align: left; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; margin-top: 1rem; font-family: monospace; font-size: 0.9em;">
                        ${error.message}
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});

// TEMPORARY DEBUG: Test Payone API directly from Vercel
router.get('/debug-payone', async (req, res) => {
    const https = require('https');

    const invoicesData = {
        merchantID: process.env.PAYONE_MERCHANT_ID || 'NOT_SET',
        authenticationToken: process.env.PAYONE_AUTH_TOKEN || 'NOT_SET',
        invoicesDetails: [{
            invoiceID: 'DBG' + Date.now(),
            amount: '1',
            currency: '682',
            paymentDescription: 'Debug Test',
            customerID: 'DebugUser',
            customerEmailAddress: 'debug@test.com',
            language: 'en',
            expiryperiod: '1D',
            notifyMe: 'no',
            generateQRCode: 'no'
        }]
    };

    const jsonStr = JSON.stringify(invoicesData);
    const baseUrl = process.env.PAYONE_BASE_URL || 'https://smartlinkdb-test.payone.io/URL2PayAdminWeb/rest/InvoicesService';
    const apiUrl = baseUrl + '/createInvoice';
    const results = {};

    // Method 1: fetch with raw body
    try {
        const body1 = 'invoices=' + jsonStr;
        const r1 = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body1
        });
        results.fetch_raw = await r1.text();
    } catch (e) {
        results.fetch_raw_err = e.message;
    }

    // Method 2: fetch with URLSearchParams
    try {
        const params = new URLSearchParams();
        params.set('invoices', jsonStr);
        const r2 = await fetch(apiUrl, {
            method: 'POST',
            body: params
        });
        results.fetch_urlsearchparams = await r2.text();
    } catch (e) {
        results.fetch_urlsearchparams_err = e.message;
    }

    // Method 3: native https  
    try {
        const body3 = 'invoices=' + jsonStr;
        const urlObj = new URL(apiUrl);
        const r3 = await new Promise((resolve, reject) => {
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body3)
                }
            };
            const r = https.request(options, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => resolve(data));
            });
            r.on('error', reject);
            r.write(body3);
            r.end();
        });
        results.native_https = r3;
    } catch (e) {
        results.native_https_err = e.message;
    }

    results.nodeVersion = process.version;
    results.apiUrl = apiUrl;
    results.jsonLength = jsonStr.length;

    res.json(results);
});

// Backward compatibility for old route (defaults to Moyasar)
router.get('/:orderId', (req, res) => {
    res.redirect(`/checkout/moyasar/${req.params.orderId}`);
});

router.get('/payment/success', (req, res) => {
    res.send('<h1>تم الدفع بنجاح!</h1><p>شكراً لثقتك بنا.</p>');
});

router.get('/payment/failure', (req, res) => {
    res.send('<h1>فشلت عملية الدفع</h1><p>يرجى المحاولة مرة أخرى.</p>');
});

module.exports = router;
