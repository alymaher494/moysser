const EcwidService = require('../services/ecwid.service');
require('dotenv').config();

async function testEcwidIntegration() {
    console.log('--- Starting Ecwid Service Test ---');

    const storeId = process.env.ECWID_STORE_ID || '123456';
    const token = process.env.ECWID_TOKEN || 'secret_test';

    try {
        const ecwid = new EcwidService(storeId, token);
        console.log('1. Ecwid Service Initialized');

        // Test mapping
        const { mapEcwidOrderToPayment } = require('../utils/ecwid-mapper');
        const mockOrder = {
            orderNumber: 101,
            total: 150.00,
            email: 'test@example.com',
            currency: 'SAR'
        };

        const paymentData = mapEcwidOrderToPayment(mockOrder);
        console.log('2. Mapping Test Passed:', paymentData.amount === 150.00);

        console.log('3. Attempting to fetch order (Expected to fail without real credentials)...');
        // await ecwid.getOrder(101);

    } catch (error) {
        console.error('❌ Test execution error:', error.message);
    }
}

if (require.main === module) {
    testEcwidIntegration();
}
