const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger'); // assuming logger exists

class EdfapayService {
    constructor() {
        this.merchantKey = process.env.EDFAPAY_MERCHANT_KEY;
        this.apiPassword = process.env.EDFAPAY_API_PASSWORD;
        this.baseUrl = process.env.EDFAPAY_BASE_URL || 'https://api.edfapay.com';
        
        if (!this.merchantKey || !this.apiPassword) {
            logger.warn('Edfapay initialized without credentials. Integration incomplete.');
        }
    }

    async createPayment(orderData) {
        try {
            // Handle both direct fields AND Ecwid-mapped fields (customerEmail, customerName, etc.)
            const email = (orderData.email || orderData.customerEmail || 'customer@example.com').trim();
            const orderId = (orderData.order_id || orderData.orderId || `order_${Date.now()}`).trim();
            const amount = parseFloat(orderData.amount).toFixed(2);
            const currency = (orderData.currency || 'SAR').trim();

            // Parse customer name (Ecwid sends full name as customerName)
            const fullName = orderData.customerName || '';
            const nameParts = fullName.split(' ');
            const firstName = (orderData.first_name || nameParts[0] || 'Guest').trim();
            const lastName = (orderData.last_name || nameParts.slice(1).join(' ') || 'Customer').trim();

            // Build success/cancel URLs from callback_url if available
            let baseCallbackUrl = '';
            if (orderData.callback_url) {
                const urlObj = new URL(orderData.callback_url);
                baseCallbackUrl = `${urlObj.protocol}//${urlObj.host}`;
            }
            const successUrl = orderData.success_url || (baseCallbackUrl ? `${baseCallbackUrl}/checkout/payment/success` : 'https://moysser.vercel.app/checkout/payment/success');
            const cancelUrl = orderData.cancel_url || (baseCallbackUrl ? `${baseCallbackUrl}/checkout/payment/failure` : 'https://moysser.vercel.app/checkout/payment/failure');

            const params = new URLSearchParams();
            params.append('action', 'SALE');
            params.append('edfa_merchant_id', this.merchantKey.trim());
            params.append('order_id', orderId);
            params.append('order_amount', amount);
            params.append('order_currency', currency);
            params.append('order_description', (orderData.description || `Payment for Order #${orderId}`).trim());
            params.append('payer_first_name', firstName);
            params.append('payer_last_name', lastName);
            params.append('payer_email', email);
            params.append('payer_phone', (orderData.phone || orderData.customerPhone || '0500000000').trim());
            params.append('payer_address', (orderData.address || 'Street 1').trim());
            params.append('payer_city', (orderData.city || 'Riyadh').trim());
            params.append('payer_zip', (orderData.zip_code || '12345').trim());
            params.append('payer_country', (orderData.country || 'SA').trim());
            params.append('payer_ip', (orderData.payer_ip || '156.204.1.1').trim());
            params.append('success_url', successUrl);
            params.append('cancel_url', cancelUrl);

            // Generate hash for checkout/initiate (no card number available)
            const hash = this.generateHash(email);
            params.append('hash', hash);

            logger.info(`[Edfapay] Initiating payment: Order=${orderId}, Amount=${amount} ${currency}, Email=${email}`);

            const response = await axios.post(`${this.baseUrl}/payment/initiate`, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            });

            // Handle successful initiation
            if (response.data && response.data.result === 'REDIRECT') {
                return {
                    id: response.data.order_id,
                    transactionId: response.data.transaction_id,
                    status: 'initiated',
                    redirectUrl: response.data.redirect_url,
                    source: response.data
                };
            }

            // Handle error cases more explicitly
            if (response.data && response.data.result === 'ERROR') {
                const errDetails = JSON.stringify(response.data.errors || response.data.error_message);
                logger.error(`[Edfapay] API Error Response: ${errDetails}`);
                throw new Error(`Edfapay Error: ${response.data.error_message || 'Unknown error'}`);
            }

            throw new Error(`Edfapay Create Payment Error: Invalid response format`);
            
        } catch (error) {
            const errorMsg = error.response?.data?.error_message || error.response?.data?.error || error.message;
            const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : 'No response data';
            logger.error(`[Edfapay] Error creating payment: ${errorMsg} | Details: ${errorDetails}`);
            throw new Error(errorMsg);
        }
    }

    /**
     * Alias for createPayment to match project service interface
     */
    async createInvoice(orderData) {
        const payment = await this.createPayment(orderData);
        return {
            url: payment.redirectUrl,
            id: payment.transactionId || payment.id
        };
    }

    /**
     * Inquires the status of the transaction from Edfapay API.
     */
    async getPayment(transactionId) {
        try {
            const params = new URLSearchParams();
            params.append('edfa_merchant_id', this.merchantKey);
            params.append('transaction_id', transactionId);
            
            // Formula for status inquiry often differs, 
            // but usually involves MD5 of transaction_id + password
            const hashString = (transactionId + this.apiPassword.trim()).toUpperCase();
            const hash = crypto.createHash('md5').update(hashString).digest('hex');
            params.append('hash', hash);

            const response = await axios.post(`${this.baseUrl}/payment/status`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const paymentData = response.data;
            
            // Map the API status to standard system statuses (paid, failed)
            let normalizedStatus = 'failed';
            const status = paymentData.status ? paymentData.status.toUpperCase() : '';
            
            if (status === 'SUCCESS' || status === 'APPROVED' || status === 'SETTLED') {
                normalizedStatus = 'paid';
            } else if (status === 'DECLINED' || status === 'ERROR' || status === 'FILTERED') {
                normalizedStatus = 'failed';
            } else if (status === 'PENDING') {
                normalizedStatus = 'initiated';
            }

            return {
                id: transactionId,
                status: normalizedStatus,
                originalStatus: paymentData.status,
                source: paymentData
            };
        } catch (error) {
            logger.error(`[Edfapay] Error fetching payment info: ${error.message}`);
            throw error;
        }
    }

    /**
     * Helper to generate security hash if required by Edfapay.
     */
    /**
     * Generate security hash for EdfaPay.
     * Official formula from docs:
     * HASH = MD5( UPPERCASE( Reverse(payer_email) + password + Reverse(card_first6 + card_last4) ) )
     * For Checkout/Initiate (hosted), card data is not available,
     * so we use: MD5( UPPERCASE( Reverse(payer_email) + password ) )
     */
    generateHash(email, cardNumber = null) {
        const reverse = (str) => [...str].reverse().join('');
        
        let baseString;
        if (cardNumber) {
            // S2S flow with card number
            const first6 = cardNumber.slice(0, 6);
            const last4 = cardNumber.slice(-4);
            baseString = reverse(email) + this.apiPassword + reverse(first6 + last4);
        } else {
            // Checkout/Initiate flow without card number
            baseString = reverse(email) + this.apiPassword.trim();
        }
        
        const finalString = baseString.toUpperCase();
        return crypto.createHash('md5').update(finalString).digest('hex');
    }
}

module.exports = EdfapayService;
