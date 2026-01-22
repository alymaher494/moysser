/**
 * Standardized Response Formatter
 */

const sendResponse = (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
        success: statusCode >= 200 && statusCode < 300,
        message,
        data,
        timestamp: new Date().toISOString(),
    });
};

const success = (res, message, data = null) => {
    return sendResponse(res, 200, message, data);
};

const created = (res, message, data = null) => {
    return sendResponse(res, 201, message, data);
};

module.exports = {
    sendResponse,
    success,
    created,
};
