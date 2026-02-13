const axios = require('axios');
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
     * Based on Payone SmartLink official Java sample code:
     *   The body is sent as: invoices=<RAW_JSON_STRING>
     *   Content-Type: application/x-www-form-urlencoded
     *   The JSON must NOT be URL-encoded.
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        // Build the invoices JSON object per Payone SmartLink API docs
        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: this.authToken,
            invoicesDetails: [{
                invoiceID: String(paymentData.orderId),
                amount: String(paymentData.amount),
                currency: '682', // SAR = ISO 4217 numeric code 682
                paymentDescription: paymentData.description || `Order ${paymentData.orderId}`,
                customerID: paymentData.metadata?.customer_name || 'Guest',
                customerEmailAddress: paymentData.metadata?.customer_email || '',
                language: 'ar',
                expiryperiod: '1D',
                notifyMe: 'no',
                generateQRCode: 'no'
            }]
        };

        try {
            logger.info(`[Payone] Creating invoice for Order #${paymentData.orderId}`);

            // Per official Java sample: "invoices=" + jsonObject.toString()
            // Sent as raw string body, NOT URL-encoded
            const requestBody = 'invoices=' + JSON.stringify(invoicesData);

            logger.info(`[Payone] Request Body: ${requestBody}`);

            const response = await axios.post(`${this.baseUrl}/createInvoice`, requestBody, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            logger.info('[Payone] Raw Response: ' + JSON.stringify(response.data));

            // Extract payment link from response
            // Response: { invoicesDetails: [{ paymentLink: "...", invoiceID: "...", ... }] }
            if (response.data && response.data.invoicesDetails && response.data.invoicesDetails.length > 0) {
                const invoiceResult = response.data.invoicesDetails[0];
                return {
                    id: invoiceResult.invoiceID || paymentData.orderId,
                    url: invoiceResult.paymentLink,
                    status: 'INITIATED'
                };
            }

            // If response has error
            if (response.data && response.data.Error) {
                throw new Error(`Payone Error ${response.data.Error}: ${response.data.ErrorMessage}`);
            }

            // Fallback - return full response for debugging
            return response.data;

        } catch (error) {
            logger.error('[Payone] Create Invoice Error:', error.response?.data || error.message);
            console.error('[Payone] Full Error Details:', JSON.stringify(error.response?.data || error.message, null, 2));
            throw new ApiError(500, 'Failed to create Payone invoice: ' + (error.response?.data?.ErrorMessage || error.message));
        }
    }
}

module.exports = PayoneService;
