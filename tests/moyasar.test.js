const MoyasarService = require('../services/moyasar.service');
const { validatePaymentData } = require('../validators/payment.validator');
require('dotenv').config();

async function testIntegration() {
    console.log('--- Starting Moyasar Service Test ---');

    // Use a dummy key if env is not set
    const apiKey = process.env.MOYASAR_API_KEY_TEST || 'sk_test_12345';
    const moyasar = new MoyasarService(apiKey);

    const testData = {
        amount: 50.00,
        currency: 'SAR',
        description: 'Test Order Payment',
        source: {
            type: 'creditcard'
        },
        callback_url: 'http://localhost:3000/api/payments/callback'
    };

    try {
        console.log('1. Validating Payment Data...');
        validatePaymentData(testData);
        console.log('✅ Validation Passed');

        console.log('2. Creating Payment Request (Moyasar API)...');
        // This will likely fail with a 401 if the key is invalid, which is fine for structure test
        const payment = await moyasar.createPayment(testData);
        console.log('✅ Payment Created:', payment.id);

    } catch (error) {
        console.error('❌ Test Failed:', error.statusCode, error.message);
        if (error.stack) console.debug('Stack:', error.stack);
    }
}

if (require.main === module) {
    testIntegration();
}
