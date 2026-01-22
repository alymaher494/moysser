const MoyasarService = require('../services/moyasar.service');
const response = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

const moyasar = new MoyasarService(process.env.MOYASAR_API_KEY_LIVE || process.env.MOYASAR_API_KEY_TEST);

/**
 * Payment Controller
 */
const createPayment = async (req, res, next) => {
    try {
        const payment = await moyasar.createPayment(req.body);
        return response.created(res, 'Payment initiated successfully', payment);
    } catch (error) {
        next(error);
    }
};

const getPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
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

module.exports = {
    createPayment,
    getPayment,
    verifyPayment
};
