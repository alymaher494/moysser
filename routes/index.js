const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');
const testController = require('../controllers/test.controller');
const response = require('../utils/response');

// Import new routes
const paymentRoutes = require('./payments');
const orderRoutes = require('./orders');
const webhookRoutes = require('./webhooks');

/**
 * Base Landing Route
 */
router.get('/', (req, res) => {
    response.success(res, 'Welcome to Moyasar-Ecwid Integration API', {
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            payments: '/api/payments',
            orders: '/api/orders',
            webhooks: '/api/webhooks'
        }
    });
});

/**
 * Core API Routes
 */
router.get('/health', healthController.checkHealth);
router.get('/test', testController.runTest);

// Secure or disable /env in production
router.get('/env', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ success: false, message: 'Endpoint disabled for security' });
    }
    return testController.getEnv(req, res);
});

// Sub-routes
router.use('/payments', paymentRoutes);
router.use('/orders', orderRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
