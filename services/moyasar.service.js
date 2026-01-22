const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError, InternalServerError } = require('../utils/errors');
const { toHalalah } = require('../utils/currency');

class MoyasarService {
    /**
     * @param {string} apiKey - Moyasar Secret Key
     */
    constructor(apiKey) {
        if (!apiKey) {
            throw new InternalServerError('Moyasar API Key is missing');
        }

        this.apiKey = apiKey.trim();
        this.baseUrl = 'https://api.moyasar.com/v1';

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 10000, // 10 seconds timeout
            auth: {
                username: this.apiKey,
                password: '', // Password is empty for Moyasar basic auth
            },
        });

        // Add interceptors for error logging
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                const status = error.response ? error.response.status : 500;
                const data = error.response ? error.response.data : {};
                logger.error(`Moyasar API Error: ${status}`, data);

                throw new ApiError(
                    status,
                    data.message || 'Moyasar API Request Failed',
                    true,
                    JSON.stringify(data.errors || {})
                );
            }
        );
    }

    /**
     * Create a payment
     * @param {Object} paymentData 
     */
    async createPayment(paymentData) {
        try {
            const payload = {
                amount: toHalalah(paymentData.amount),
                currency: paymentData.currency,
                description: paymentData.description,
                source: paymentData.source,
                callback_url: paymentData.callback_url,
                metadata: paymentData.metadata || {},
            };

            logger.info(`Creating Moyasar payment for amount: ${paymentData.amount} ${paymentData.currency}`);
            const response = await this.client.post('/payments', payload);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get payment details
     * @param {string} id 
     */
    async getPayment(id) {
        try {
            const response = await this.client.get(`/payments/${id}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * List payments
     * @param {Object} params 
     */
    async listPayments(params = {}) {
        try {
            const response = await this.client.get('/payments', { params });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Refund a payment
     * @param {string} id 
     * @param {number} amount - Amount in SAR
     */
    async refundPayment(id, amount) {
        try {
            const payload = amount ? { amount: toHalalah(amount) } : {};
            const response = await this.client.post(`/payments/${id}/refund`, payload);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = MoyasarService;
