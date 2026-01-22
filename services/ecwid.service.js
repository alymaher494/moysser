const axios = require('axios');
const logger = require('../utils/logger');
const { InternalServerError, ApiError } = require('../utils/errors');

class EcwidService {
    /**
     * @param {string} storeId - Ecwid Store ID
     * @param {string} token - Ecwid API Token (Secret Token)
     */
    constructor(storeId, token) {
        if (!storeId || !token) {
            throw new InternalServerError('Ecwid Store ID or Token is missing');
        }

        this.storeId = storeId;
        this.token = token;
        this.baseUrl = `https://app.ecwid.com/api/v3/${this.storeId}`;

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 10000,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            params: {
                token: this.token,
            },
        });

        // Error logging interceptor
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                const status = error.response ? error.response.status : 500;
                const data = error.response ? error.response.data : {};
                logger.error(`Ecwid API Error: ${status}`, data);

                throw new ApiError(
                    status,
                    data.errorMessage || 'Ecwid API Request Failed',
                    true,
                    JSON.stringify(data)
                );
            }
        );
    }

    /**
     * Get order details
     * @param {string|number} orderNumber - Ecwid Order Number
     */
    async getOrder(orderNumber) {
        try {
            logger.info(`Fetching Ecwid order details for order: #${orderNumber}`);
            const response = await this.client.get(`/orders/${orderNumber}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update order payment status
     * @param {string|number} orderNumber 
     * @param {string} status - PAID, AWAITING_PAYMENT, CANCELLED, etc.
     * @param {Object} paymentDetails - Optional details like transaction ID
     */
    async updateOrderPaymentStatus(orderNumber, status, paymentDetails = {}) {
        try {
            logger.info(`Updating Ecwid order #${orderNumber} payment status to: ${status}`);
            const payload = {
                paymentStatus: status,
                externalTransactionId: paymentDetails.transactionId,
                paymentMessage: paymentDetails.message
            };

            const response = await this.client.put(`/orders/${orderNumber}`, payload);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Add a private admin note to an order
     * @param {string|number} orderNumber 
     * @param {string} note 
     */
    async addOrderNote(orderNumber, note) {
        try {
            const response = await this.client.put(`/orders/${orderNumber}`, {
                privateAdminNotes: note
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = EcwidService;
