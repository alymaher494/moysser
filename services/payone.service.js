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
     * V7 FIXES:
     * 1. Currency: Trying "SAR" (Alpha) instead of "682" (Numeric). Logic error might be mismatched currency format.
     * 2. Amount: Keeping "X.00" format because it passed JSON validation (unlike Integer/Minor units).
     * 3. Case Sensitivity: "yes" instead of "Yes" (Docs sample uses lowercase 'yes' in some places).
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        const safeValidationDesc = `Order ${paymentData.orderId}`;
        const cleanToken = (this.authToken || '').replace(/\s+/g, '');

        // V7: Amount - Strict 2 decimal places (Passed JSON check).
        const amountString = Number(paymentData.amount).toFixed(2);

        // V7: Shorten Invoice ID
        const shortTimestamp = String(Date.now()).slice(-5);
        const uniqueInvoiceId = `${paymentData.orderId}-${shortTimestamp}`;

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: cleanToken,
            invoicesDetails: [{
                // renderMode removed (caused noise)
                invoiceID: uniqueInvoiceId,
                amount: amountString,
                currency: 'SAR', // V7: TRYING ALPHA CODE "SAR" (Common fix for 'Invalid Amount' if numeric 682 isn't mapped)
                paymentDescription: safeValidationDesc,
                customerID: 'Guest',
                customerEmailAddress: 'customer@moysser-app.com',
                language: 'ar',
                expiryperiod: '1D',
                customerMobileNumber: '00966500000000',
                notifyMe: 'yes', // Lowercase per sample?
                generateQRCode: 'yes' // Lowercase per sample?
            }]
        };

        const jsonStr = JSON.stringify(invoicesData);

        try {
            logger.info(`[Payone] [FIXED V7] Request: ${amountString} SAR (Alpha), ID: ${uniqueInvoiceId}`);

            const params = new URLSearchParams();
            params.set('invoices', jsonStr);

            const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
            const url = `${base}/createInvoice`;

            const response = await fetch(url, {
                method: 'POST',
                body: params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
