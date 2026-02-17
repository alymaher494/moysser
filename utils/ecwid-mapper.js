/**
 * Format phone number to be compatible with Payment Gateways (00966...)
 */
const cleanPhoneNumber = (phone) => {
    if (!phone) return '00966500000000';

    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^0-9+]/g, '');

    // Replace leading + with 00
    if (cleaned.startsWith('+')) {
        cleaned = '00' + cleaned.substring(1);
    }

    // Handle SA local numbers (05xxxxxxxx) -> Convert to 009665xxxxxxxx
    if (cleaned.startsWith('05') && cleaned.length === 10) {
        cleaned = '00966' + cleaned.substring(1);
    }

    // If number doesn't start with 00 (international), and is 9 digits (5xxxxxxxx), add 00966
    if (!cleaned.startsWith('00') && cleaned.length === 9 && cleaned.startsWith('5')) {
        cleaned = '00966' + cleaned;
    }

    // Fallback if cleaning failed to empty string (will use default later if needed) or return valid
    return cleaned || '00966500000000';
};

const mapEcwidOrderToPayment = (order) => {
    // Priority: Billing Phone -> Shipping Phone -> Fallback
    const rawPhone = order.billingPerson?.phone || order.shippingPerson?.phone || '';
    const formattedPhone = cleanPhoneNumber(rawPhone);

    return {
        orderId: String(order.orderNumber), // Use Order Number for payment references
        amount: order.total,
        currency: order.currency || 'SAR',
        description: `Payment for Ecwid Order #${order.orderNumber}`,
        customerEmail: order.email || 'customer@example.com',
        customerPhone: formattedPhone,
        customerName: order.billingPerson?.name || 'Guest',
        callback_url: '', // To be filled by the route handler
        metadata: {
            order_id: String(order.id || ''),
            order_number: String(order.orderNumber || ''),
            customer_email: String(order.email || 'customer@example.com'),
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
        'initiated': 'AWAITING_PAYMENT',
        'expired': 'CANCELLED',
        'new': 'AWAITING_PAYMENT',
        'pending_refund_approval': 'AWAITING_PAYMENT'
    };

    return statusMap[moyasarStatus.toLowerCase()] || 'AWAITING_PAYMENT';
};

module.exports = {
    mapEcwidOrderToPayment,
    mapMoyasarStatusToEcwid
};
