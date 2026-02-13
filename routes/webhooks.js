const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const verifyMoyasar = require('../middlewares/moyasar-webhook.middleware');
const verifyEcwid = require('../middlewares/ecwid-webhook.middleware');

router.post('/moyasar', verifyMoyasar, webhookController.handleMoyasarWebhook);
router.post('/ecwid', verifyEcwid, webhookController.handleEcwidWebhook);
router.get('/test', webhookController.testWebhook);

module.exports = router;

