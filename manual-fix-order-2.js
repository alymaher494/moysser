require('dotenv').config();
const PayoneService = require('./services/payone.service');
const EcwidService = require('./services/ecwid.service');
const { mapMoyasarStatusToEcwid } = require('./utils/ecwid-mapper');

async function checkAndUpdateOrder(orderId, suffix) {
    console.log(`Checking status for Order #${orderId}...`);

    try {
        const payone = new PayoneService();
        // Construct the likely Invoice ID based on the pattern: OrderID-Suffix
        const invoiceId = `${orderId}-${suffix}`;
        console.log(`Using Invoice ID: ${invoiceId}`);

        const invoiceData = await payone.inquireInvoice(invoiceId);
        console.log('Payone Invoice Status:', invoiceData.invoiceStatus);

        const payoneStatus = invoiceData.invoiceStatus;
        const ecwidStatus = mapMoyasarStatusToEcwid(payoneStatus.toLowerCase());

        console.log(`Updating Ecwid Order ${orderId} to ${ecwidStatus}...`);

        const ecwid = new EcwidService(process.env.ECWID_STORE_ID, process.env.ECWID_TOKEN);
        await ecwid.updateOrderPaymentStatus(orderId, ecwidStatus, {
            transactionId: invoiceId,
            message: `[Manual Fix] Payone confirmed: ${payoneStatus}`
        });

        console.log('✅ Ecwid Updated Successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) console.error(error.response.data);
    }
}

// Order ID: 616226876 (from last test)
// Suffix: 74611 (from screenshot)
checkAndUpdateOrder('616226876', '74611');
