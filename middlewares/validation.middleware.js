const { validatePaymentData } = require('../validators/payment.validator');
const { BadRequestError } = require('../utils/errors');

/**
 * Validation Middleware for Payments
 */
const validatePayment = (req, res, next) => {
    try {
        validatePaymentData(req.body);
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    validatePayment,
};
