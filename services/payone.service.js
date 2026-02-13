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
     * V10 FIXES (Based on successful exhaustive probing):
     * 1. Currency: "682" (Numeric) is required.
     * 2. Amount: Minor Units (e.g. "500" for 5.00 SAR). Integer string.
     * 3. Notifications: 'notifyMe=yes' is mandatory.
     * 4. Email: 'notificationEmail' is mandatory (and requires 'dynamicFields' to be valid JSON!).
     * 5. Dynamic Fields: '[{ItemID:"1"}]' is mandatory for schema validation.
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        const safeValidationDesc = `Order ${paymentData.orderId}`;
        const cleanToken = (this.authToken || '').replace(/\s+/g, '');

        // V10: Amount - Minor Units (Halalas). e.g. 5.50 -> 550.
        // Use Math.round to handle floating point precision (5.50 * 100 = 550.00000001)
        const amountMinor = Math.round(Number(paymentData.amount) * 100).toString();

        const shortTimestamp = String(Date.now()).slice(-5);
        const uniqueInvoiceId = `${paymentData.orderId}-${shortTimestamp}`;

        // Ensure customer email is valid or use fallback
        const validEmail = (paymentData.customerEmail && paymentData.customerEmail.includes('@'))
            ? paymentData.customerEmail
            : 'customer@moysser-app.com';

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: cleanToken,
            invoicesDetails: [{
                invoiceID: uniqueInvoiceId,
                amount: amountMinor,
                currency: '682',
                paymentDescription: safeValidationDesc,
                customerID: paymentData.customerId || 'Guest',
                customerEmailAddress: validEmail,
                language: 'ar',
                expiryperiod: '1D',
                customerMobileNumber: paymentData.customerPhone || '00966500000000',
                notifyMe: 'yes',
                notificationEmail: validEmail,
                dynamicFields: [{ ItemID: '1' }], // CRITICAL: Required for Schema Validation
                generateQRCode: 'yes'
            }]
        };

        const jsonStr = JSON.stringify(invoicesData);

        try {
            logger.info(`[Payone] [FIXED V10] Request: ${amountMinor} (Minor 682), ID: ${uniqueInvoiceId}`);

            const params = new URLSearchParams();
            params.set('invoices', jsonStr);

            const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
            const url = `${base}/createInvoice`;

            const response = await fetch(url, {
                method: 'POST',
                body: params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PayoneClient/1.0'
                }
            });

            const textResponse = await response.text();
            let responseData;

            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                throw new Error(`Invalid non-JSON response: ${textResponse.substring(0, 100)}`);
            }

            logger.info('[Payone] Response: ' + JSON.stringify(responseData));

            if (responseData.Error) {
                // Mask token in logs for security
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
