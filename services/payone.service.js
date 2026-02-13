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
     * Uses Buffer to handle multi-byte (Arabic) characters correctly
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
                    'Content-Length': bodyBuffer.length
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
     * Uses native https. All text fields are sanitized to ASCII-safe values.
     * TESTED & CONFIRMED WORKING on Vercel 2026-02-13.
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        // Sanitize text fields to ASCII-only (remove Arabic/special chars that break form encoding)
        const safeName = (paymentData.metadata?.customer_name || 'Guest').replace(/[^\x20-\x7E]/g, '');
        const safeDesc = `Order ${paymentData.orderId}`;

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: this.authToken,
            invoicesDetails: [{
                invoiceID: String(paymentData.orderId) + '-' + Date.now(),
                amount: String(paymentData.amount),
                currency: '682',
                paymentDescription: safeDesc,
                customerID: safeName || 'Guest',
                customerEmailAddress: paymentData.metadata?.customer_email || '',
                language: 'ar',
                expiryperiod: '1D',
                notifyMe: 'no',
                generateQRCode: 'no'
            }]
        };

        try {
            logger.info(`[Payone] Creating invoice for Order #${paymentData.orderId}`);

            const jsonStr = JSON.stringify(invoicesData);
            const requestBody = 'invoices=' + jsonStr;

            // Convert to Buffer to ensure correct Content-Length for all charsets
            const bodyBuffer = Buffer.from(requestBody, 'utf-8');

            logger.info(`[Payone] Body length: ${bodyBuffer.length}`);

            const responseData = await this._post(`${this.baseUrl}/createInvoice`, bodyBuffer);

            logger.info('[Payone] Response: ' + JSON.stringify(responseData));

            // Check for API-level error
            if (responseData && responseData.Error) {
                throw new Error(`Payone Error ${responseData.Error}: ${responseData.ErrorMessage}`);
            }

            // Extract payment link from response
            if (responseData && responseData.invoicesDetails && responseData.invoicesDetails.length > 0) {
                const invoiceResult = responseData.invoicesDetails[0];
                return {
                    id: invoiceResult.invoiceID || paymentData.orderId,
                    url: invoiceResult.paymentLink,
                    status: 'INITIATED'
                };
            }

            // Fallback
            return responseData;

        } catch (error) {
            const errMsg = error.message || 'Unknown error';
            logger.error('[Payone] Create Invoice Error:', errMsg);
            throw new ApiError(500, 'Failed to create Payone invoice: ' + errMsg);
        }
    }
}

module.exports = PayoneService;
