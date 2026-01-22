const getEcwidService = () => {
    return new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
};

/**
 * Webhook Controller
 */
const handleMoyasarWebhook = async (req, res, next) => {
    try {
        const ecwid = getEcwidService();
        const { id, status, amount, metadata } = req.body.data || req.body;
        const orderNumber = metadata.order_number || metadata.order_id;

        logger.info(`Received Moyasar webhook for Order #${orderNumber}, Status: ${status}`);

        if (orderNumber) {
            const ecwidStatus = mapMoyasarStatusToEcwid(status);
            await ecwid.updateOrderPaymentStatus(orderNumber, ecwidStatus, {
                transactionId: id,
                message: `Updated via Moyasar Webhook. Status: ${status}`
            });
            logger.info(`Successfully updated Ecwid Order #${orderNumber} to ${ecwidStatus}`);
        }

        // Always respond with 200 to Moyasar to acknowledge receipt
        return res.status(200).send('Webhook Received');
    } catch (error) {
        logger.error('Error handling Moyasar webhook:', error);
        // Still return 200 to avoid retries if the issue is logic-related, 
        // or 500 if we want a retry.
        return res.status(200).send('Error but acknowledged');
    }
};

const handleEcwidWebhook = async (req, res, next) => {
    try {
        const event = req.body;
        logger.info(`Received Ecwid webhook: ${event.eventType} for Store: ${event.storeId}`);

        // Logic for Ecwid events (e.g., cancelling a payment if order item is deleted)

        return res.status(200).send('OK');
    } catch (error) {
        next(error);
    }
};

const testWebhook = (req, res) => {
    return response.success(res, 'Webhook endpoint is reachable');
};

module.exports = {
    handleMoyasarWebhook,
    handleEcwidWebhook,
    testWebhook
};
