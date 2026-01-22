const response = require('../utils/response');

/**
 * Health Check Controller
 */
const checkHealth = (req, res) => {
    const healthInfo = {
        status: 'UP',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        node_version: process.version,
        env: process.env.NODE_ENV || 'development'
    };

    return response.success(res, 'System is healthy', healthInfo);
};

module.exports = {
    checkHealth
};
