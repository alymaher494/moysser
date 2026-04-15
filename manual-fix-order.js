require('dotenv').config();
const PayoneService = require('./services/payone.service');
const EcwidService = require('./services/ecwid.service');
const { mapMoyasarStatusToEcwid } = require('./utils/ecwid-mapper');

async function checkAndUpdateOrder(orderId, invoiceId) {
    console.log(`Checking status for Order #${orderId} (Invoice: ${invoiceId})...`);

    try {
        const payone = new PayoneService();
        // Since we don't have the exact Invoice ID structure in memory, let's try to inquire by the reference we likely used.
        // Actually, Payone requires the exact Invoice ID returned from creation.
        // Based on logs/screenshots, the Invoice ID was "616208935-46469" (seen in success page).

        // Wait, Payone's 'inquireInvoice' takes the Payone Reference ID?
        // Let's check payone.service.js inquireInvoice implementation.
        // If we don't have the exact ID, we might be stuck. But let's try with the known ID from screenshot.

        const knownInvoiceId = '616208935-46469'; // Taken from screenshot

        console.log(`Inquiring Invoice: ${knownInvoiceId}`);
        const invoiceData = await payone.inquireInvoice(knownInvoiceId);
        console.log('Payone Invoice Data:', JSON.stringify(invoiceData, null, 2));

        const payoneStatus = invoiceData.invoiceStatus;
        const ecwidStatus = mapMoyasarStatusToEcwid(payoneStatus.toLowerCase());

        console.log(`Mapped Status: ${payoneStatus} -> ${ecwidStatus}`);

        const ecwid = new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
        await ecwid.updateOrderPaymentStatus(orderId, ecwidStatus, {
            transactionId: knownInvoiceId,
            message: `[Manual Fix] Payone verified: ${payoneStatus}`
        });

        console.log('Ecwid Updated Successfully!');

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.error(error.response.data);
    }
}

// Order ID from user request
checkAndUpdateOrder('616208935', '616208935-46469');
