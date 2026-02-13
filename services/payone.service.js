const logger = require('../utils/logger');
const { InternalServerError, ApiError } = require('../utils/errors');

class PayoneService {
    constructor() {
        this.merchantId = process.env.PAYONE_MERCHANT_ID;
        this.authToken = process.env.PAYONE_AUTH_TOKEN;
        this.baseUrl = process.env.PAYONE_BASE_URL || 'https://smartlinkdb-test.payone.io/URL2PayAdminWeb/rest/InvoicesService';
    }

    /**
     * Create an invoice link for the customer.
     * Uses Node.js native fetch with URLSearchParams.
     * CONFIRMED WORKING METHOD + STRICT DATA FORMATTING (V3)
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        // SAFE MODE: Use hardcoded safe values to prevent JSON format errors
        const safeValidationDesc = `Order ${paymentData.orderId}`;

        // V3: Clean token strictly (remove ALL spaces, not just trim)
        // User email showed "ZGI... Q0" which has a space inside.
        const cleanToken = (this.authToken || '').replace(/\s+/g, '');

        // V3: Format amount strictly to 2 decimal places (e.g. "10.00")
        const formattedAmount = Number(paymentData.amount).toFixed(2);

        // V3: Shorten Invoice ID to avoid hitting typical gateway limits (20 chars)
        // Current: OrderID (9) + dash (1) + short timestamp (5) = 15 chars. Perfectly safe.
        const shortTimestamp = String(Date.now()).slice(-5);
        const uniqueInvoiceId = `${paymentData.orderId}-${shortTimestamp}`;

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: cleanToken,
            invoicesDetails: [{
                renderMode: 'test',
                invoiceID: uniqueInvoiceId,
                amount: formattedAmount,
                currency: '682',
                paymentDescription: safeValidationDesc,
                customerID: 'Guest',
                customerEmailAddress: 'customer@moysser-app.com',
                language: 'ar',
                expiryperiod: '1D',
                notifyMe: 'no',
                generateQRCode: 'no'
            }]
        };

        const jsonStr = JSON.stringify(invoicesData);
        let lastError = null;

        try {
            logger.info(`[Payone] [FIXED V3] Sending request for Order #${paymentData.orderId}`);

            // Use URLSearchParams which handles encoding consistently across environments
            const params = new URLSearchParams();
            params.set('invoices', jsonStr);

            // Construct URL - handle potential double slash issues
            const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
            const url = `${base}/createInvoice`;

            const response = await fetch(url, {
                method: 'POST',
                body: params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // Handle non-JSON responses (HTML errors etc)
            const textResponse = await response.text();
            let responseData;

            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                // If response is not JSON, it's a fatal error from server/proxy
                throw new Error(`Invalid non-JSON response: ${textResponse.substring(0, 100)}`);
            }

            logger.info('[Payone] Response: ' + JSON.stringify(responseData));

            // Check API-level errors
            if (responseData.Error) {
                // V3: Include JSON payload in error message for definitive debugging
                const maskedPayload = jsonStr.replace(cleanToken, '***TOKEN***');
                throw new Error(`[API] Payone Error ${responseData.Error}: ${responseData.ErrorMessage} || PAYLOAD: ${maskedPayload}`);
            }

            // Extract payment link
            if (responseData.invoicesDetails && responseData.invoicesDetails.length > 0) {
                const invoiceResult = responseData.invoicesDetails[0];
                return {
                    id: invoiceResult.invoiceID || paymentData.orderId,
                    url: invoiceResult.paymentLink,
                    status: 'INITIATED'
                };
            }

            return responseData;

        } catch (error) {
            logger.error('[Payone] Create Invoice Error:', error.message);
            throw new ApiError(500, 'Failed to create Payone invoice: ' + error.message);
        }
    }
}

module.exports = PayoneService;
