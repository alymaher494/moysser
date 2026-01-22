const { BadRequestError } = require('../utils/errors');

/**
 * Validator for Payment Creation
 */
const validatePaymentData = (data) => {
    const { amount, currency, description, source } = data;

    // Amount Validation
    if (!amount || isNaN(amount) || amount <= 0) {
        throw new BadRequestError('Invalid amount. Amount must be a positive number.');
    }

    // Currency Validation (Moyasar primarily SAR for Saudi market)
    if (currency !== 'SAR') {
        throw new BadRequestError('Invalid currency. Only SAR is supported.');
    }

    // Description Validation
    if (!description || typeof description !== 'string' || description.trim() === '') {
        throw new BadRequestError('Description is required.');
    }

    // Source Validation
    if (!source || !source.type) {
        throw new BadRequestError('Payment source type is required.');
    }

    const allowedSourceTypes = ['creditcard', 'applepay', 'stcpay'];
    if (!allowedSourceTypes.includes(source.type)) {
        throw new BadRequestError(`Invalid source type. Allowed types: ${allowedSourceTypes.join(', ')}`);
    }

    return true;
};

module.exports = {
    validatePaymentData,
};
