const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/:id', auth, orderController.getOrder);
router.post('/:id/pay', auth, orderController.initiateOrderPayment);
router.post('/:id/sync', auth, orderController.syncOrderStatus);

module.exports = router;
