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
     * CONFIRMED WORKING METHOD + V6 SCHEMA ALIGNMENT
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        // SAFE MODE
        const safeValidationDesc = `Order ${paymentData.orderId}`;
        const cleanToken = (this.authToken || '').replace(/\s+/g, '');

        // V6: Amount - Must have decimals! "2.00" passed JSON check, "2" failed.
        // We will try "10.00" to ensure we are above any potential minimum limits.
        // We force 2 decimal places.
        const amountString = Number(paymentData.amount).toFixed(2); // "2.00" or "10.00"

        // V6: Shorten Invoice ID
        const shortTimestamp = String(Date.now()).slice(-5);
        const uniqueInvoiceId = `${paymentData.orderId}-${shortTimestamp}`;

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: cleanToken,
            invoicesDetails: [{
                renderMode: 'test',
                invoiceID: uniqueInvoiceId,
                amount: amountString, // "10.00"
                currency: '682',
                paymentDescription: safeValidationDesc,
                customerID: 'Guest',
                customerEmailAddress: 'customer@moysser-app.com',
                language: 'ar',
                expiryperiod: '1D',
                // V6: Add Mobile (from sample) and Capitalize Yes/No (from sample)
                customerMobileNumber: '00966500000000',
                notifyMe: 'Yes',
                generateQRCode: 'Yes'
            }]
        };

        const jsonStr = JSON.stringify(invoicesData);

        try {
            logger.info(`[Payone] [FIXED V6] Request: ${amountString} SAR, ID: ${uniqueInvoiceId}`);

            const params = new URLSearchParams();
            params.set('invoices', jsonStr);

            const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
            const url = `${base}/createInvoice`;

            const response = await fetch(url, {
                method: 'POST',
                body: params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const textResponse = await response.text();
            let responseData;

            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                // Return descriptive error for HTML responses (500/404)
                throw new Error(`Invalid non-JSON response: ${textResponse.substring(0, 100)}`);
            }

            logger.info('[Payone] Response: ' + JSON.stringify(responseData));

            // Check API-level errors
            if (responseData.Error) {
                const maskedPayload = jsonStr.replace(cleanToken, '***TOKEN***');
                throw new Error(`[API] Payone Error ${responseData.Error}: ${responseData.ErrorMessage} || PAYLOAD: ${maskedPayload}`);
            }

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
