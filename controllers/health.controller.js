const response = require('../utils/response');

/**
 * Health Check Controller
 */
const checkHealth = (req, res) => {
    const activeKey = process.env.MOYASAR_API_KEY_LIVE || process.env.MOYASAR_API_KEY_TEST;
    const isLive = activeKey && activeKey.startsWith('sk_live_');

    const healthInfo = {
        status: 'UP',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        node_version: process.version,
        env: process.env.NODE_ENV || 'development',
        moyasar_mode: isLive ? 'LIVE' : 'TEST',
        live_key_configured: !!process.env.MOYASAR_API_KEY_LIVE
    };

    return response.success(res, `System is healthy (Mode: ${isLive ? 'LIVE' : 'TEST'})`, healthInfo);
};

module.exports = {
    checkHealth
};
