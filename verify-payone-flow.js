require('dotenv').config();
const PayoneService = require('./services/payone.service');

async function testPayoneFlow() {
    const payone = new PayoneService();

    // 1. Create Sample Invoice
    const sampleData = {
        orderId: 'TEST-' + Math.floor(Math.random() * 10000),
        amount: 1.00, // 1 SAR
        currency: 'SAR',
        customerEmail: 'test-user@moysser.com',
        customerId: 'CUST-123'
    };

    console.log('--- Step 1: Creating Invoice ---');
    try {
        const result = await payone.createInvoice(sampleData);
        console.log('SUCCESS: Invoice Created!');
        console.log('Invoice ID:', result.id);
        console.log('Payment URL:', result.url);

        console.log('\n--- Step 2: Inquiring about the newly created invoice ---');
        const inquiry = await payone.inquireInvoice(result.id);
        console.log('SUCCESS: Inquiry Response Received!');
        console.log('Current Status:', inquiry.invoiceStatus);
        console.log('Amount:', inquiry.amount);
        console.log('Full Response Metadata:', JSON.stringify(inquiry, null, 2));

    } catch (error) {
        console.error('FAILED:', error.message);
    }
}

testPayoneFlow();
