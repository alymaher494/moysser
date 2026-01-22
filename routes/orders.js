const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const auth = require('../middlewares/auth.middleware');

// Unauthenticated route for Ecwid Custom Payment Method redirect
router.post('/ecwid-redirect', (req, res) => {
    const orderId = req.body.order_id || req.body.orderId || req.query.order_id;
    if (!orderId) {
        return res.status(400).send('Missing order_id');
    }
    // Redirect the user to the visual checkout bridge
    return res.redirect(`/checkout/${orderId}`);
});

router.get('/:id', auth, orderController.getOrder);
router.post('/:id/pay', auth, orderController.initiateOrderPayment);
router.post('/:id/sync', auth, orderController.syncOrderStatus);

module.exports = router;
