const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const auth = require('../middlewares/auth.middleware');

// Unauthenticated route for Ecwid Custom Payment Method redirect (Dynamic Gateway)
router.post('/:gateway/redirect', (req, res) => {
    const { gateway } = req.params;
    const orderId = req.body.order_id || req.body.orderId || req.query.order_id || req.body.orderNumber;
    
    if (!orderId) {
        return res.status(400).send('Missing order_id');
    }
    
    // Redirect the user directly to the specific gateway's checkout process
    return res.redirect(`/checkout/${gateway}/${orderId}`);
});

// Backward compatibility for the old Moyasar generic redirect
router.post('/ecwid-redirect', (req, res) => {
    const orderId = req.body.order_id || req.body.orderId || req.query.order_id || req.body.orderNumber;
    if (!orderId) {
        return res.status(400).send('Missing order_id');
    }
    return res.redirect(`/checkout/moyasar/${orderId}`);
});

// Public route for payment bridge script
router.get('/:id/payment-method', orderController.getPaymentMethod);

router.get('/:id', auth, orderController.getOrder);
router.post('/:id/pay', auth, orderController.initiateOrderPayment);
router.post('/:id/sync', auth, orderController.syncOrderStatus);

module.exports = router;
