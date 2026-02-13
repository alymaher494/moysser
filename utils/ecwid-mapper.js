/**
 * Utility to map data between Ecwid and local objects/Moyasar
 */

const mapEcwidOrderToPayment = (order) => {
    return {
        orderId: String(order.orderNumber), // Use Order Number for payment references
        amount: order.total,
        currency: order.currency || 'SAR',
        description: `Payment for Ecwid Order #${order.orderNumber}`,
        callback_url: '', // To be filled by the route handler
        metadata: {
            order_id: String(order.id || ''),
            order_number: String(order.orderNumber || ''),
            customer_email: String(order.email || ''),
            customer_name: String(order.billingPerson?.name || 'Guest'), // Add customer name
            platform: 'Ecwid'
        }
    };
};

const mapMoyasarStatusToEcwid = (moyasarStatus) => {
    const statusMap = {
        'paid': 'PAID',
        'authorized': 'AWAITING_PAYMENT',
        'captured': 'PAID',
        'failed': 'CANCELLED',
        'cancelled': 'CANCELLED',
        'refunded': 'REFUNDED',
        'voided': 'CANCELLED',
        'initiated': 'AWAITING_PAYMENT'
    };

    return statusMap[moyasarStatus.toLowerCase()] || 'AWAITING_PAYMENT';
};

module.exports = {
    mapEcwidOrderToPayment,
    mapMoyasarStatusToEcwid
};
