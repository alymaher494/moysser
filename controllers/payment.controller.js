const MoyasarService = require('../services/moyasar.service');
const response = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

const getMoyasarService = () => {
    const apiKey = process.env.MOYASAR_API_KEY_LIVE || process.env.MOYASAR_API_KEY_TEST;
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

const handleCallback = async (req, res, next) => {
    try {
        const { orderId, id, status, message } = req.query;
        const moyasar = getMoyasarService();

        // If we have an ID (payment ID), verify it
        if (id) {
            const payment = await moyasar.getPayment(id);
            const ecwidStatus = mapMoyasarStatusToEcwid(payment.status);
            const ecwid = getEcwidService();

            await ecwid.updateOrderPaymentStatus(orderId, ecwidStatus, {
                transactionId: id,
                message: `Updated via Callback. Status: ${payment.status}`
            });
        }

        // Redirect user back to the store or a success page
        // For now, let's redirect to our own success/failure pages
        if (status === 'paid' || status === 'captured') {
            return res.redirect('/checkout/payment/success');
        } else {
            return res.redirect('/checkout/payment/failure');
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPayment,
    getPayment,
    verifyPayment,
    handleCallback
};
