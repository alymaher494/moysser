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

        // Sanitize phone number for Payone (must be 009665xxxxxxxx format)
        const safePhone = this._sanitizePhoneForPayone(paymentData.customerPhone);

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
                customerMobileNumber: safePhone,
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

    /**
     * Sanitize phone number for Payone API
     * Payone requires format: 009665xxxxxxxx (14 digits total)
     * Error 00013 = Invalid Customer Mobile Number Format
     */
    _sanitizePhoneForPayone(phone) {
        const DEFAULT_PHONE = '00966500000000';

        if (!phone || typeof phone !== 'string') return DEFAULT_PHONE;

        // Remove all non-digit characters
        let digits = phone.replace(/[^0-9]/g, '');

        // If empty after cleaning, return default
        if (!digits || digits.length < 7) return DEFAULT_PHONE;

        // Already in 00966 format (14 digits) - valid
        if (digits.startsWith('00966') && digits.length === 14) return digits;

        // Starts with 966 (without 00 prefix)
        if (digits.startsWith('966') && digits.length === 12) return '00' + digits;

        // Saudi local format: 05xxxxxxxx (10 digits)
        if (digits.startsWith('05') && digits.length === 10) return '00966' + digits.substring(1);

        // Saudi without leading 0: 5xxxxxxxx (9 digits)
        if (digits.startsWith('5') && digits.length === 9) return '00966' + digits;

        // Any other format - try prepending 00966 if it looks like a local number
        if (digits.length >= 7 && digits.length <= 10) return '00966' + digits;

        // If it's already a long international number, try to use as-is with 00 prefix
        if (digits.length >= 11 && !digits.startsWith('00')) return '00' + digits;
        if (digits.length >= 13 && digits.startsWith('00')) return digits;

        // Fallback to default
        return DEFAULT_PHONE;
    }
}

module.exports = PayoneService;
