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
     * V8 FIXES:
     * 1. Amount: Converting to Minor Units (Halalas/Cents) -> "500" (for 5.00 SAR).
     * 2. Currency: "SAR" (Alpha code).
     * 3. Hypothesis: "Invalid JSON" (00017) with integer amounts might have been due to missing fields or other noise. Now we have a complete payload.
     *    "Invalid Amount" (00004) with "500.00" suggests decimals are strictly forbidden for SAR logic, even if schema accepts the format.
     */
    async createInvoice(paymentData) {
        if (!this.merchantId || !this.authToken) {
            throw new InternalServerError('Payone credentials (MERCHANT_ID or AUTH_TOKEN) are missing.');
        }

        const safeValidationDesc = `Order ${paymentData.orderId}`;
        const cleanToken = (this.authToken || '').replace(/\s+/g, '');

        // V8: Amount - Minor Units (Integers). 
        // e.g. 5.00 => "500"
        const amountMinor = Math.round(Number(paymentData.amount) * 100).toString();

        const shortTimestamp = String(Date.now()).slice(-5);
        const uniqueInvoiceId = `${paymentData.orderId}-${shortTimestamp}`;

        const invoicesData = {
            merchantID: this.merchantId,
            authenticationToken: cleanToken,
            invoicesDetails: [{
                renderMode: 'test',
                invoiceID: uniqueInvoiceId,
                amount: amountMinor, // "500"
                currency: 'SAR',     // "SAR"
                paymentDescription: safeValidationDesc,
                customerID: 'Guest',
                customerEmailAddress: 'customer@moysser-app.com',
                language: 'ar',
                expiryperiod: '1D',
                customerMobileNumber: '00966500000000',
                notifyMe: 'yes',
                generateQRCode: 'yes'
            }]
        };

        const jsonStr = JSON.stringify(invoicesData);

        try {
            logger.info(`[Payone] [FIXED V8] Request: ${amountMinor} (Minor Units) SAR, ID: ${uniqueInvoiceId}`);

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
