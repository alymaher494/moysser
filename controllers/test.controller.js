const response = require('../utils/response');

/**
 * Test Controller
 */
const runTest = (req, res) => {
    return response.success(res, 'Test endpoint working correctly', {
        echo: req.query.message || 'No message provided',
        headers: req.headers['user-agent']
    });
};

const getEnv = (req, res) => {
    if (process.env.NODE_ENV === 'production' && req.query.key !== process.env.APP_API_KEY) {
        return response.sendResponse(res, 403, 'Environment variables access is disabled or invalid key provided');
    }

    const activeKey = process.env.MOYASAR_API_KEY_LIVE || process.env.MOYASAR_API_KEY_TEST;
    const isLive = activeKey && activeKey.startsWith('sk_live_');

    // Return non-sensitive env vars for safety
    const publicEnv = {
        NODE_ENV: process.env.NODE_ENV,
        ACTIVE_MODE: isLive ? 'LIVE' : 'TEST',
        PORT: process.env.PORT,
        ECWID_STORE_ID: process.env.ECWID_STORE_ID ? 'Configured' : 'Missing',
        ECWID_TOKEN: process.env.ECWID_TOKEN ? 'Configured' : 'Missing',
        MOYASAR_API_KEY_TEST: process.env.MOYASAR_API_KEY_TEST ? 'Configured' : 'Missing',
        MOYASAR_API_KEY_LIVE: process.env.MOYASAR_API_KEY_LIVE ? 'Configured' : 'Missing',
        APP_API_KEY: process.env.APP_API_KEY ? 'Configured' : 'Missing'
    };

    return response.success(res, `Current environment configuration (${isLive ? 'LIVE' : 'TEST'})`, publicEnv);
};

module.exports = {
    runTest,
    getEnv
};
