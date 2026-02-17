const logger = require('../utils/logger');
const { InternalServerError, ApiError } = require('../utils/errors');

/**
 * Payone Payment Gateway Service
 * Manages the integration with Payone SmartLink API.
 */
class PayoneService {
    constructor() {
        this.merchantId = process.env.PAYONE_MERCHANT_ID;
        this.authToken = process.env.PAYONE_AUTH_TOKEN;
        this.baseUrl = process.env.PAYONE_BASE_URL || 'https://smartlinkdb-test.payone.io/URL2PayAdminWeb/rest/InvoicesService';
    }

    /**
     * Create a secure payment link via Payone SmartLink
     * @param {Object} paymentData - Standardized payment information
     * @returns {Promise<Object>} Object containing payment URL and ID
     */
    async createInvoice(paymentData) {
        this._validateConfig();

        const cleanToken = (this.authToken || '').replace(/\s+/g, '');
        const amountMinor = Math.round(Number(paymentData.amount) * 100).toString(); // Convert to Halalas
        const uniqueInvoiceId = `${paymentData.orderId}-${String(Date.now()).slice(-5)}`;

        const customerEmail = (paymentData.customerEmail && paymentData.customerEmail.includes('@'))
            ? paymentData.customerEmail
            : 'customer@moysser-app.com';

        const payload = {
            merchantID: this.merchantId,
            authenticationToken: cleanToken,
            invoicesDetails: [{
                invoiceID: uniqueInvoiceId,
                amount: amountMinor,
                currency: '682', // SAR Numeric Code
                paymentDescription: `Order ${paymentData.orderId}`,
                customerID: 'Guest',
                customerEmailAddress: customerEmail,
                language: paymentData.language || 'ar',
                expiryperiod: '2D',
                customerMobileNumber: paymentData.customerPhone || '00966500000000',
                notifyMe: 'yes',
                notificationEmail: customerEmail,
                dynamicFields: [{ itemID: '1' }], // Required for schema validation
                generateQRCode: 'yes'
            }]
        };

        try {
            const apiUrl = this._getApiUrl();
            const body = `invoices=${JSON.stringify(payload)}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: body,
                headers: {
                    'User-Agent': 'MoysserPaymentClient/1.0',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const textResponse = await response.text();
            let responseData;

            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                throw new Error(`Unexpected non-JSON response from Payone: ${textResponse.substring(0, 100)}`);
            }

            if (responseData.Error) {
                throw new Error(`Payone API Error ${responseData.Error}: ${responseData.ErrorMessage}`);
            }

            if (responseData.invoicesDetails && responseData.invoicesDetails.length > 0) {
                const invoice = responseData.invoicesDetails[0];
                return {
                    id: invoice.invoiceID,
                    url: invoice.paymentLink,
                    status: 'INITIATED'
                };
            }

            throw new Error('Success response received but no invoice details found');

        } catch (error) {
            logger.error('[Payone Service] Failed:', error);
            throw new ApiError(500, `Payone integration failed: ${error.message}`);
        }
    }

    async inquireInvoice(invoiceId) {
        this._validateConfig();

        const cleanToken = (this.authToken || '').replace(/\s+/g, '');
        const payload = {
            authenticationToken: cleanToken,
            merchantID: this.merchantId,
            invoiceID: invoiceId
        };

        try {
            const apiUrl = this._getApiUrl('inquireInvoice');
            const bodyParams = new URLSearchParams({ invoice: JSON.stringify(payload) });

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: bodyParams,
                headers: { 'User-Agent': 'MoysserPaymentClient/1.0' }
            });

            const textResponse = await response.text();
            let responseData;

            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                throw new Error(`Unexpected non-JSON response from Payone: ${textResponse.substring(0, 100)}`);
            }

            if (responseData.Error) {
                throw new Error(`Payone API Error ${responseData.Error}: ${responseData.ErrorMessage}`);
            }

            return responseData; // Returns the full invoice object containing status, etc.

        } catch (error) {
            logger.error('[Payone Service] Inquire Failed:', error.message);
            throw new ApiError(500, `Payone inquiry failed: ${error.message}`);
        }
    }

    /* Helper Methods */

    _validateConfig() {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone configuration error: MERCHANT_ID or AUTH_TOKEN is missing in environment variables.');
        }
    }

    _getApiUrl(endpoint = 'createInvoice') {
        const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
        return `${base}/${endpoint}`;
    }
}

module.exports = PayoneService;
