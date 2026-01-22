const EcwidService = require('../services/ecwid.service');
const MoyasarService = require('../services/moyasar.service');
const { mapEcwidOrderToPayment } = require('../utils/ecwid-mapper');
const response = require('../utils/response');
const logger = require('../utils/logger');

const ecwid = new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
const moyasar = new MoyasarService(process.env.MOYASAR_API_KEY_LIVE || process.env.MOYASAR_API_KEY_TEST);

/**
 * Order Controller
 */
const getOrder = async (req, res, next) => {
    try {
        const order = await ecwid.getOrder(req.params.id);
        return response.success(res, 'Order details retrieved', order);
    } catch (error) {
        next(error);
    }
};

const initiateOrderPayment = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Get order from Ecwid
        const order = await ecwid.getOrder(id);

        // 2. Map Ecwid order to Moyasar payment data
        const paymentData = mapEcwidOrderToPayment(order);

        // 3. Add callback and metadata
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('host');
        paymentData.callback_url = `${protocol}://${host}/api/payments/callback?orderId=${id}`;
        paymentData.source = { type: 'creditcard' }; // Default or from request

        // 4. Create payment in Moyasar
        const payment = await moyasar.createPayment(paymentData);

        // 5. Return the transaction URL to redirect the user
        return response.success(res, 'Payment initiated', {
            orderId: id,
            paymentId: payment.id,
            transactionUrl: payment.source.transaction_url
        });
    } catch (error) {
        next(error);
    }
};

const syncOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { paymentId } = req.body;

        const payment = await moyasar.getPayment(paymentId);
        const { mapMoyasarStatusToEcwid } = require('../utils/ecwid-mapper');
        const ecwidStatus = mapMoyasarStatusToEcwid(payment.status);

        await ecwid.updateOrderPaymentStatus(id, ecwidStatus, {
            transactionId: paymentId,
            message: `Synced via API. Moyasar status: ${payment.status}`
        });

        return response.success(res, 'Order status synced', {
            orderId: id,
            newStatus: ecwidStatus
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getOrder,
    initiateOrderPayment,
    syncOrderStatus
};
