const https = require('https');
const logger = require('../utils/logger');
const { InternalServerError, ApiError } = require('../utils/errors');

class PayoneService {
    constructor() {
        this.merchantId = process.env.PAYONE_MERCHANT_ID;
        this.authToken = process.env.PAYONE_AUTH_TOKEN;
        this.baseUrl = process.env.PAYONE_BASE_URL || 'https://smartlinkdb-test.payone.io/URL2PayAdminWeb/rest/InvoicesService';
    }

    /**
     * Make a POST request using native https
     * Uses Buffer to handle multi-byte characters correctly
     */
    _post(url, bodyBuffer) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': bodyBuffer.length,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                });
            });

            req.on('error', reject);
            req.end(bodyBuffer);
        });
    }

    /**
     * Create an invoice link for the customer.
     * Implements a Smart Retry Strategy:
     * 1. Try Raw JSON (works locally/Java/some envs).
     * 2. If 'Invalid JSON Format' (00017), fallback to URL Encoded JSON.
     * TESTED & CONFIRMED WORKING strategy for cross-environment compatibility.
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        // Sanitize text fields strictly
        const unsafeChars = /[^a-zA-Z0-9\s\-\._@]/g;

        const safeName = (paymentData.metadata?.customer_name || 'Guest').replace(unsafeChars, '');
        const safeDesc = (`Order ${paymentData.orderId}`).replace(unsafeChars, '');
        const safeEmail = (paymentData.metadata?.customer_email || '').replace(/[^a-zA-Z0-9@\.\-_]/g, '');

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: this.authToken,
            invoicesDetails: [{
                // Ensure unique ID for every attempt including retries
                invoiceID: String(paymentData.orderId).replace(unsafeChars, '') + '-' + Date.now(),
                amount: String(paymentData.amount),
                currency: '682',
                paymentDescription: safeDesc,
                customerID: safeName || 'Guest',
                customerEmailAddress: safeEmail,
                language: 'ar',
                expiryperiod: '1D',
                notifyMe: 'no',
                generateQRCode: 'no'
            }]
        };

        const jsonStr = JSON.stringify(invoicesData);
        let lastError = null;

        // STRATEGY 1: Raw JSON (Preferred by Payone Java docs & works locally)
        try {
            logger.info(`[Payone] Attempt 1 (Raw JSON) for Order #${paymentData.orderId}`);
            const requestBody = 'invoices=' + jsonStr;
            const bodyBuffer = Buffer.from(requestBody, 'utf-8');

            const response = await this._post(`${this.baseUrl}/createInvoice`, bodyBuffer);

            // Check success
            if (response && !response.Error && response.invoicesDetails) {
                return this._parseResponse(response, paymentData.orderId);
            }

            // If error is NOT 00017, throw it (real error like auth fail)
            if (response.Error && response.Error !== '00017') {
                throw new Error(`Payone Error ${response.Error}: ${response.ErrorMessage}`);
            }

            // If Error IS 00017, just log and allow fallthrough to Strategy 2
            logger.warn(`[Payone] Attempt 1 failed with Invalid JSON (00017), switching to Encoded strategy.`);

        } catch (error) {
            // Save error and try next strategy
            lastError = error;
            logger.warn(`[Payone] Attempt 1 Exception: ${error.message}`);
        }

        // STRATEGY 2: URL Encoded (Standard Web Standard)
        try {
            logger.info(`[Payone] Attempt 2 (Encoded JSON) for Order #${paymentData.orderId}`);

            // We must update the invoiceID to avoid "Duplicate Invoice ID" if the first one actually reached the server but failed parsing partially
            invoicesData.invoicesDetails[0].invoiceID += '-R2';
            const jsonStrRetry = JSON.stringify(invoicesData);

            const requestBody = 'invoices=' + encodeURIComponent(jsonStrRetry);
            const bodyBuffer = Buffer.from(requestBody, 'utf-8');

            const response = await this._post(`${this.baseUrl}/createInvoice`, bodyBuffer);

            if (response && !response.Error && response.invoicesDetails) {
                return this._parseResponse(response, paymentData.orderId);
            }

            if (response.Error) {
                throw new Error(`Payone Error ${response.Error}: ${response.ErrorMessage}`);
            }

            return response; // Fallback

        } catch (error) {
            const errMsg = error.message || lastError?.message || 'Unknown error';
            logger.error('[Payone] Create Invoice Error (All Strategies Failed):', errMsg);
            throw new ApiError(500, 'Failed to create Payone invoice: ' + errMsg);
        }
    }

    /**
     * Helper to parse successful response
     */
    _parseResponse(responseData, orderId) {
        if (responseData && responseData.invoicesDetails && responseData.invoicesDetails.length > 0) {
            const invoiceResult = responseData.invoicesDetails[0];
            return {
                id: invoiceResult.invoiceID || orderId,
                url: invoiceResult.paymentLink,
                status: 'INITIATED'
            };
        }
        return responseData;
    }
}

module.exports = PayoneService;
