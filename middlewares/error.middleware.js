const logger = require('../utils/logger');

/**
 * Global Error Handling Middleware
 */
const errorMiddleware = (err, req, res, next) => {
    let { statusCode, message } = err;

    if (!statusCode) {
        statusCode = 500;
    }

    const response = {
        success: false,
        message,
        // Include detailed error data for 400 errors to help debug validation issues
        ...((process.env.NODE_ENV === 'development' || statusCode === 400) && { errors: err.stack }),
    };

    if (statusCode === 500) {
        logger.error(`${req.method} ${req.url} - ${message}`, { stack: err.stack });
    } else {
        logger.warn(`${req.method} ${req.url} - ${statusCode} - ${message}`);
    }

    res.status(statusCode).json(response);
};

module.exports = errorMiddleware;
