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
    if (process.env.NODE_ENV === 'production') {
        return response.sendResponse(res, 403, 'Environment variables access is disabled in production');
    }

    // Return non-sensitive env vars for safety
    const publicEnv = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        ECWID_STORE_ID: process.env.ECWID_STORE_ID ? 'Configured' : 'Missing',
        MOYASAR_API_KEY_TEST: process.env.MOYASAR_API_KEY_TEST ? 'Configured' : 'Missing'
    };

    return response.success(res, 'Current environment configuration', publicEnv);
};

module.exports = {
    runTest,
    getEnv
};
