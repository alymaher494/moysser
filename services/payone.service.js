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
     * SAFE MODE + SMART RETRY STRATEGY.
     * Uses hardcoded "safe" values for non-essential fields to prevent JSON format errors.
     * Tries Raw JSON first, then Encoded JSON.
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        // SAFE MODE: Use hardcoded safe values to prevent JSON format errors caused by user data
        // We only populate essential fields with dynamic data (ID, Amount)
        const safeValidationDesc = `Order ${paymentData.orderId}`;

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: this.authToken,
            invoicesDetails: [{
                // Update InvoiceID with Retry counter to be safe
                invoiceID: String(paymentData.orderId) + '-' + Date.now(),
                amount: String(paymentData.amount),
                currency: '682',
                paymentDescription: safeValidationDesc,
                customerID: 'Guest', // Hardcoded to prevent encoding issues
                customerEmailAddress: 'customer@moysser-app.com', // Hardcoded valid email
                language: 'ar',
                expiryperiod: '1D',
                notifyMe: 'no',
                generateQRCode: 'no'
            }]
        };

        const jsonStr = JSON.stringify(invoicesData);
        let lastError = null;

        // STRATEGY 1: Raw JSON
        try {
            logger.info(`[Payone] Attempt 1 (Raw) for Order #${paymentData.orderId}`);
            const requestBody = 'invoices=' + jsonStr;
            const bodyBuffer = Buffer.from(requestBody, 'utf-8');

            const response = await this._post(`${this.baseUrl}/createInvoice`, bodyBuffer);

            if (response && !response.Error && response.invoicesDetails) {
                return this._parseResponse(response, paymentData.orderId);
            }

            // If error is 00017, specifically log it and continue to retry
            if (response.Error === '00017') {
                logger.warn(`[Payone] Attempt 1 failed with 00017 (Invalid JSON), retrying encoded...`);
            } else if (response.Error) {
                // Other errors (Auth, Limit, etc) -> Throw immediately
                throw new Error(`[S1] Payone Error ${response.Error}: ${response.ErrorMessage}`);
            }

        } catch (error) {
            lastError = error;
            logger.warn(`[Payone] Attempt 1 Error: ${error.message}`);
        }

        // STRATEGY 2: Encoded JSON
        try {
            logger.info(`[Payone] Attempt 2 (Encoded) for Order #${paymentData.orderId}`);

            // Modify ID for second attempt to avoid duplicate errors
            invoicesData.invoicesDetails[0].invoiceID += '-R2';
            const jsonStrRetry = JSON.stringify(invoicesData);

            const requestBody = 'invoices=' + encodeURIComponent(jsonStrRetry);
            const bodyBuffer = Buffer.from(requestBody, 'utf-8');

            const response = await this._post(`${this.baseUrl}/createInvoice`, bodyBuffer);

            if (response && !response.Error && response.invoicesDetails) {
                return this._parseResponse(response, paymentData.orderId);
            }

            if (response.Error) {
                // If this fails, it's the final error
                throw new Error(`[S2] Payone Error ${response.Error}: ${response.ErrorMessage}`);
            }

            return response;

        } catch (error) {
            const errMsg = error.message || lastError?.message || 'Unknown error';
            logger.error('[Payone] All Strategies Failed:', errMsg);
            throw new ApiError(500, 'Failed to create Payone invoice: ' + errMsg);
        }
    }

    _parseResponse(response, orderId) {
        if (response.invoicesDetails && response.invoicesDetails.length > 0) {
            const invoiceResult = response.invoicesDetails[0];
            return {
                id: invoiceResult.invoiceID || orderId,
                url: invoiceResult.paymentLink,
                status: 'INITIATED'
            };
        }
        return response;
    }
}

module.exports = PayoneService;
