const axios = require('axios');
const logger = require('../utils/logger');
const { InternalServerError, ApiError } = require('../utils/errors');

class NoonService {
    constructor() {
        this.businessId = process.env.NOON_BUSINESS_ID;
        this.appName = process.env.NOON_APP_NAME;
        this.appKey = process.env.NOON_APP_KEY;
        this.mode = process.env.NOON_MODE || 'TEST'; // TEST or LIVE
        this.baseUrl = this.mode === 'LIVE'
            ? 'https://api.noonpayments.com/payment/v1'
            : 'https://api-test.noonpayments.com/payment/v1';
    }

    /**
     * Create an invoice/order link for the customer
     * @param {Object} paymentData
     */
    async createInvoice(paymentData) {
        if (!this.businessId || !this.appKey || !this.appName) {
            throw new InternalServerError('Noon credentials (BUSINESS_ID, APP_NAME, or APP_KEY) are missing.');
        }

        // Prepare the payload for INITIATE
        const payload = {
            apiOperation: "INITIATE",
            order: {
                reference: paymentData.orderId,
                amount: paymentData.amount,
                currency: paymentData.currency,
                name: `Order #${paymentData.orderId}`,
                channel: "web",
                category: "pay"
            },
            configuration: {
                locale: "en", // Default to English, could be passed in paymentData
                returnUrl: paymentData.callback_url,
                tokenizeCc: "true" // Optional: if we want to save card
            }
        };

        // Authorization Header Format: Key <BusinessId>.<AppName>:<AppKey>
        // Note: Some integrations require Base64 encoding of the key part, but standard "Key" schema implies this format.
        // If Base64 is needed, it would be `Basic ${Buffer.from(...).toString('base64')}`.
        // Referring to Noon docs: Authorization: Key <BusinessIdentifier>.<ApplicationIdentifier>:<ApplicationKey>
        const authHeader = `Key ${this.businessId}.${this.appName}:${this.appKey}`;

        try {
            logger.info(`[Noon] Creating order for Order #${paymentData.orderId}`);

            const response = await axios.post(`${this.baseUrl}/order`, payload, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": authHeader
                }
            });

            // Check for success (resultCode === 0)
            if (response.data && response.data.resultCode === 0 && response.data.result && response.data.result.checkoutData) {
                return {
                    id: response.data.result.orderId,
                    url: response.data.result.checkoutData.postUrl, // The redirect URL for the payment page
                    status: 'INITIATED'
                };
            }

            logger.warn('[Noon] Unexpected response structure or error code:', response.data);
            throw new Error(response.data.message || 'Failed to initiate Noon payment (Result Code not 0)');

        } catch (error) {
            logger.error('[Noon] Create Order Error:', error.response?.data || error.message);
            throw new ApiError(500, 'Failed to create Noon invoice');
        }
    }

    /**
     * Get order details to verify status
     * @param {string} orderId 
     */
    async getOrder(orderId) {
        try {
            const authHeader = `Key ${this.businessId}.${this.appName}:${this.appKey}`;

            // Check with Noon API for order
            const response = await axios.get(`${this.baseUrl}/order/${orderId}`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": authHeader
                }
            });

            if (response.data && response.data.result) {
                return response.data.result;
            }

            throw new Error('Noon Order not found or invalid response');

        } catch (error) {
            logger.error(`[Noon] Get Order Error for ${orderId}:`, error.response?.data || error.message);
            throw new ApiError(500, 'Failed to fetch Noon order status');
        }
    }
}

module.exports = NoonService;
