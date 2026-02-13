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
     * Payone SmartLink API: POST body = invoices=<URL_ENCODED_JSON>
     * Content-Type: application/x-www-form-urlencoded
     * TESTED & CONFIRMED WORKING on 2026-02-13.
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

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

            const jsonStr = JSON.stringify(invoicesData);
            // MUST use encodeURIComponent - tested and confirmed working
            const requestBody = 'invoices=' + encodeURIComponent(jsonStr);

            const response = await axios.post(`${this.baseUrl}/createInvoice`, requestBody, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            logger.info('[Payone] Response: ' + JSON.stringify(response.data));

            // Check for API-level error
            if (response.data && response.data.Error) {
                throw new Error(`Payone Error ${response.data.Error}: ${response.data.ErrorMessage}`);
            }

            // Extract payment link from response
            if (response.data && response.data.invoicesDetails && response.data.invoicesDetails.length > 0) {
                const invoiceResult = response.data.invoicesDetails[0];
                return {
                    id: invoiceResult.invoiceID || paymentData.orderId,
                    url: invoiceResult.paymentLink,
                    status: 'INITIATED'
                };
            }

            // Fallback
            return response.data;

        } catch (error) {
            const errMsg = error.response?.data?.ErrorMessage || error.message;
            logger.error('[Payone] Create Invoice Error:', errMsg);
            throw new ApiError(500, 'Failed to create Payone invoice: ' + errMsg);
        }
    }
}

module.exports = PayoneService;
