const logger = require('../utils/logger');
const PayoneService = require('./payone.service');
const EcwidService = require('./ecwid.service');
const { mapMoyasarStatusToEcwid } = require('../utils/ecwid-mapper');

/**
 * Payone Delayed Inquiry Scheduler
 * 
 * As recommended by Payone support:
 * "Implement this function and deploy it to trigger the inquiry 
 *  after 3-5 minutes of the payment occurrence.
 *  This will ensure that the payment cycle special cases are covered 
 *  and all the payments are up to date from both of our sides."
 * 
 * This service schedules a delayed inquiry for each Payone invoice
 * to verify and sync the final payment status with Ecwid.
 */

// In-memory store for pending inquiries (in production, use Redis or DB)
const pendingInquiries = new Map();

const INQUIRY_DELAY_MS = 4 * 60 * 1000; // 4 minutes (between 3-5 as recommended)

/**
 * Schedule a delayed inquiry for a Payone invoice
 * @param {string} invoiceId - The Payone invoice ID
 * @param {string} ecwidOrderId - The corresponding Ecwid order ID
 */
function scheduleInquiry(invoiceId, ecwidOrderId) {
    if (!invoiceId || !ecwidOrderId) {
        logger.warn('[Payone Scheduler] Missing invoiceId or ecwidOrderId, skipping schedule.');
        return;
    }

    // Avoid duplicate schedules for the same invoice
    if (pendingInquiries.has(invoiceId)) {
        logger.info(`[Payone Scheduler] Inquiry already scheduled for invoice ${invoiceId}`);
        return;
    }

    logger.info(`[Payone Scheduler] Scheduling inquiry for invoice ${invoiceId} (Order #${ecwidOrderId}) in ${INQUIRY_DELAY_MS / 1000}s`);

    const timerId = setTimeout(async () => {
        await executeInquiry(invoiceId, ecwidOrderId);
        pendingInquiries.delete(invoiceId);
    }, INQUIRY_DELAY_MS);

    pendingInquiries.set(invoiceId, {
        timerId,
        ecwidOrderId,
        scheduledAt: new Date().toISOString()
    });
}

/**
 * Execute the actual inquiry and update Ecwid if needed
 */
async function executeInquiry(invoiceId, ecwidOrderId) {
    try {
        logger.info(`[Payone Scheduler] Executing delayed inquiry for invoice ${invoiceId} (Order #${ecwidOrderId})`);

        const payone = new PayoneService();
        const invoiceData = await payone.inquireInvoice(invoiceId);

        const payoneStatus = invoiceData.invoiceStatus; // PAID, REFUNDED, NEW, EXPIRED, PENDING_REFUND_APPROVAL
        logger.info(`[Payone Scheduler] Invoice ${invoiceId} status: ${payoneStatus}`);

        // Map Payone status to Ecwid status
        const ecwidStatus = mapMoyasarStatusToEcwid(payoneStatus.toLowerCase());

        // Update Ecwid order
        const ecwid = new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
        await ecwid.updateOrderPaymentStatus(ecwidOrderId, ecwidStatus, {
            transactionId: invoiceId,
            message: `[Scheduled Inquiry] Payone status verified: ${payoneStatus}`
        });

        logger.info(`[Payone Scheduler] Order #${ecwidOrderId} updated to ${ecwidStatus} (Payone: ${payoneStatus})`);

    } catch (error) {
        logger.error(`[Payone Scheduler] Failed inquiry for invoice ${invoiceId}:`, error.message);
    }
}

/**
 * Cancel a scheduled inquiry (e.g., if callback already confirmed payment)
 */
function cancelInquiry(invoiceId) {
    const pending = pendingInquiries.get(invoiceId);
    if (pending) {
        clearTimeout(pending.timerId);
        pendingInquiries.delete(invoiceId);
        logger.info(`[Payone Scheduler] Cancelled scheduled inquiry for invoice ${invoiceId}`);
    }
}

/**
 * Get the count of pending inquiries (for monitoring)
 */
function getPendingCount() {
    return pendingInquiries.size;
}

module.exports = {
    scheduleInquiry,
    cancelInquiry,
    getPendingCount
};
