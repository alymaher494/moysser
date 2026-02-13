const EcwidService = require('../services/ecwid.service');
const MoyasarService = require('../services/moyasar.service');
const response = require('../utils/response');
const { mapEcwidOrderToPayment } = require('../utils/ecwid-mapper');

const getEcwidService = () => {
    return new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
};

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
 * Order Controller
 */
const getOrder = async (req, res, next) => {
    try {
        const ecwid = getEcwidService();
        const order = await ecwid.getOrder(req.params.id);
        return response.success(res, 'Order details retrieved', order);
    } catch (error) {
        next(error);
    }
};

const getPaymentMethod = async (req, res, next) => {
    try {
        const { id } = req.params;
        const ecwid = getEcwidService();
        const order = await ecwid.getOrder(id);

        return response.success(res, 'Payment method retrieved', {
            orderId: id,
            paymentMethod: order.paymentMethod
        });
    } catch (error) {
        next(error);
    }
};

const initiateOrderPayment = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Get order from Ecwid
        const ecwid = getEcwidService();
        const order = await ecwid.getOrder(id);

        // 2. Map Ecwid order to Moyasar payment data
        const paymentData = mapEcwidOrderToPayment(order);

        // 3. Add callback and metadata
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('host');
        paymentData.callback_url = `${protocol}://${host}/api/payments/callback?orderId=${id}`;

        // 4. Create invoice in Moyasar (for Hosted Redirection)
        const moyasar = getMoyasarService();
        console.log(`[Moyasar] Creating invoice for order ${id}...`);
        const invoice = await moyasar.createInvoice(paymentData);

        // 5. Return the invoice URL to redirect the user
        return response.success(res, 'Payment initiated', {
            orderId: id,
            paymentId: invoice.id,
            transactionUrl: invoice.url
        });
    } catch (error) {
        next(error);
    }
};

const syncOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { paymentId } = req.body;

        const moyasar = getMoyasarService();
        const payment = await moyasar.getPayment(paymentId);
        const { mapMoyasarStatusToEcwid } = require('../utils/ecwid-mapper');
        const ecwidStatus = mapMoyasarStatusToEcwid(payment.status);

        const ecwid = getEcwidService();
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
    getPaymentMethod,
    initiateOrderPayment,
    syncOrderStatus
};
