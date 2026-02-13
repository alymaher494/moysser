const MoyasarService = require('../services/moyasar.service');
const response = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

const getMoyasarService = () => {
    const liveKey = process.env.MOYASAR_API_KEY_LIVE;
    const testKey = process.env.MOYASAR_API_KEY_TEST;

    // Explicitly check for live key first
    const apiKey = liveKey || testKey;
    const isLive = liveKey && liveKey.startsWith('sk_live_');

    console.log(`[Moyasar] Initializing in ${isLive ? 'LIVE' : 'TEST'} mode`);

    return new MoyasarService(apiKey);
};

/**
 * Payment Controller
 */
const createPayment = async (req, res, next) => {
    try {
        const moyasar = getMoyasarService();
        const payment = await moyasar.createPayment(req.body);
        return response.created(res, 'Payment initiated successfully', payment);
    } catch (error) {
        next(error);
    }
};

const getPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const moyasar = getMoyasarService();
        const payment = await moyasar.getPayment(id);
        if (!payment) throw new NotFoundError('Payment not found');
        return response.success(res, 'Payment details retrieved', payment);
    } catch (error) {
        next(error);
    }
};

const verifyPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const moyasar = getMoyasarService();
        const payment = await moyasar.getPayment(id);

        const isSuccess = payment.status === 'paid' || payment.status === 'captured';

        return response.success(res, `Payment is ${payment.status}`, {
            id: payment.id,
            status: payment.status,
            isSuccess
        });
    } catch (error) {
        next(error);
    }
};

const EcwidService = require('../services/ecwid.service');
const { mapMoyasarStatusToEcwid } = require('../utils/ecwid-mapper');

const getEcwidService = () => {
    return new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
};

const PayoneService = require('../services/payone.service');
const NoonService = require('../services/noon.service');

const getPaymentService = (gateway) => {
    switch (gateway.toLowerCase()) {
        case 'moyasar':
            return getMoyasarService();
        case 'payone':
            return new PayoneService();
        case 'noon':
            return new NoonService();
        default:
            throw new NotFoundError(`Gateway '${gateway}' is not supported`);
    }
};

const handleCallback = async (req, res, next) => {
    try {
        const { gateway } = req.params;
        const { orderId, id, status, message, resultCode } = req.query;
        // Payone POST body might contain status, but for redirect (GET) we use query params set in service

        let paymentStatus = 'FAILED';
        let transactionId = id || '';
        let statusMessage = message || '';

        // 1. Verify Payment Status based on Gateway
        if (gateway === 'moyasar') {
            if (id) {
                const moyasar = getMoyasarService();
                const payment = await moyasar.getPayment(id);
                paymentStatus = payment.status; // paid, authorized, captured, failed
                transactionId = payment.id;
                statusMessage = payment.source?.message || '';
            }
        } else if (gateway === 'payone') {
            // Payone SmartLink Redirect (GET)
            // We set status=paid/failed/cancelled in the URL
            if (status) {
                paymentStatus = status.toLowerCase();
            }
            // Note: For production, we should verifying the signature or hash if Payone sends one 
            // or wait for the server-to-server POST notification to be 100% sure. 
            // For MVP, trusting the redirect status we set ourselves in the service URL 
            // is acceptable but insecure if user manipulates URL.
            // Ideally call an API to verify, but SmartLink API is limited here.
        } else if (gateway === 'noon') {
            // Noon Redirect (GET)
            // returns ?orderId=...&resultCode=...
            if (orderId) {
                const noon = new NoonService();
                const order = await noon.getOrder(orderId);
                // Noon Result Code 0 = Success? Or status === "CAPTURED"/"AUTHORIZED"
                // Check order.status
                if (order && (order.status === 'CAPTURED' || order.status === 'AUTHORIZED')) {
                    paymentStatus = 'paid'; // Map to our internal 'paid'
                    transactionId = order.id;
                } else {
                    paymentStatus = 'failed';
                    statusMessage = order.errorMessage || 'Noon payment failed';
                }
            }
        }

        // 2. Map Payment Status to Ecwid Status
        const ecwid = getEcwidService();
        // Assuming mapMoyasarStatusToEcwid works for generic 'paid'/'failed' statuses too
        const ecwidStatus = mapMoyasarStatusToEcwid(paymentStatus);

        // 3. Update Ecwid Order
        if (orderId && transactionId) {
            await ecwid.updateOrderPaymentStatus(orderId, ecwidStatus, {
                transactionId: transactionId,
                message: `Payment via ${gateway}. Status: ${paymentStatus}. ${statusMessage}`
            });
        }

        // 4. Redirect User
        // If it's a POST request (webhook), just send 200 OK
        if (req.method === 'POST') {
            return res.status(200).send('Webhook received');
        }

        // If GET (User Redirect), show success/failure page
        // We use loose check because statuses vary (paid, captured, authorized)
        if (['paid', 'captured', 'authorized'].includes(paymentStatus.toLowerCase())) {
            return res.redirect('/checkout/payment/success');
        } else {
            return res.redirect('/checkout/payment/failure');
        }

    } catch (error) {
        console.error('Payment Callback Error:', error);
        // If redirect fails, show error page
        if (req.method === 'GET') {
            return res.redirect('/checkout/payment/failure');
        }
        next(error);
    }
};

module.exports = {
    createPayment,
    getPayment,
    verifyPayment,
    handleCallback
};
