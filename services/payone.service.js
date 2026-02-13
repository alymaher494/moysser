const axios = require('axios');
const logger = require('../utils/logger');
const { InternalServerError, ApiError } = require('../utils/errors');

class PayoneService {
    constructor() {
        this.merchantId = process.env.PAYONE_MERCHANT_ID;
        this.authToken = process.env.PAYONE_AUTH_TOKEN;
        // Correct URL based on provided details (handling the double hyphen typo likely in user input)
        this.baseUrl = process.env.PAYONE_BASE_URL || 'https://smartlinkdb-test.payone.io/URL2PayAdminWeb/rest/InvoicesService';
    }

    /**
     * Create an invoice link for the customer
     * @param {Object} paymentData
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        const payload = {
            merchantId: this.merchantId,
            token: this.authToken,
            invoice: {
                invoiceId: paymentData.orderId, // Using Order ID as Invoice ID
                amount: paymentData.amount, // Payone usually expects standard float (e.g. 10.50) not Halalas, need to check
                currency: paymentData.currency,
                description: paymentData.description || `Order #${paymentData.orderId}`,
                notificationUrl: paymentData.callback_url, // Server-to-Server notification
                successurl: `${paymentData.callback_url}&status=paid`, // User redirect success
                errorurl: `${paymentData.callback_url}&status=failed`, // User redirect error
                backurl: `${paymentData.callback_url}&status=cancelled` // User redirect back/cancel
            },
            customer: {
                customerId: paymentData.metadata?.customer_id || 'guest',
                email: paymentData.metadata?.customer_email,
                firstName: paymentData.metadata?.customer_name?.split(' ')[0] || 'Guest',
                lastName: paymentData.metadata?.customer_name?.split(' ').slice(1).join(' ') || 'User'
            }
        };

        try {
            logger.info(`[Payone] Creating invoice for Order #${paymentData.orderId}`);

            const response = await axios.post(`${this.baseUrl}/createInvoice`, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // SmartLink usually returns the link in the response
            // Expected response format needs to be handled
            if (response.data && response.data.url) {
                return {
                    id: response.data.invoiceId || paymentData.orderId,
                    url: response.data.url, // The payment link
                    status: 'INITIATED'
                };
            }

            // Fallback if structure is different (logging for debugging)
            logger.info('[Payone] Raw Response:', response.data);
            return response.data;

        } catch (error) {
            logger.error('[Payone] Create Invoice Error:', error.response?.data || error.message);
            console.error('[Payone] Full Error Details:', JSON.stringify(error.response?.data, null, 2));
            throw new ApiError(500, 'Failed to create Payone invoice: ' + (error.response?.data?.errorMessage || error.message));
        }
    }
}

module.exports = PayoneService;
