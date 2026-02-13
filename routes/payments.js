const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const auth = require('../middlewares/auth.middleware');
const { validatePayment } = require('../middlewares/validation.middleware');

router.post('/create', auth, validatePayment, paymentController.createPayment);
router.all('/callback/:gateway', paymentController.handleCallback);
router.get('/:id', auth, paymentController.getPayment);
router.post('/:id/verify', auth, paymentController.verifyPayment);

module.exports = router;
