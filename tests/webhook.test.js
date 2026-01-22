const axios = require('axios');

async function simulateWebhook() {
    console.log('--- Simulating Moyasar Webhook ---');

    const webhookData = {
        id: 'pay_123456789',
        type: 'payment',
        status: 'paid',
        amount: 10050,
        currency: 'SAR',
        metadata: {
            order_number: '1001',
            customer_email: 'test@example.com'
        }
    };

    try {
        const response = await axios.post('http://localhost:3000/api/webhooks/moyasar', {
            data: webhookData
        });
        console.log('✅ Response from server:', response.data);
    } catch (error) {
        console.error('❌ Error sending webhook:', error.message);
    }
}

simulateWebhook();
