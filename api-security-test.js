const axios = require('axios');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

const tests = [
    {
        name: 'Fix: API Key Exposure in Checkout (Ensuring Redirect)',
        run: async () => {
            try {
                // Should redirect to Moyasar (fails with 404 or 500 if Ecwid order doesn't exist, which is fine)
                // But we check that it doesn't return HTML with the key if it fails.
                const response = await axios.get(`${BASE_URL}/checkout/12345`, { maxRedirects: 0, validateStatus: null });
                if (response.status === 302) {
                    return `PASS (Redirected to: ${response.headers.location})`;
                }
                const html = response.data;
                if (html.includes('const apiKey =') || html.includes('test-key')) {
                    return 'FAIL (API Key still found in response body)';
                }
                return `PASS (Status ${response.status}, no key found)`;
            } catch (error) {
                return `ERROR (${error.message})`;
            }
        }
    },
    {
        name: 'Fix: Webhook Authentication Bypass (Moyasar)',
        run: async () => {
            try {
                const response = await axios.post(`${BASE_URL}/api/webhooks/moyasar`, {
                    id: 'pay_test_123',
                    status: 'paid'
                }, { validateStatus: null });
                return response.status === 401 ? 'PASS' : `FAIL (Status: ${response.status})`;
            } catch (error) {
                return `ERROR (${error.message})`;
            }
        }
    },
    {
        name: 'Fix: Webhook Authentication Bypass (Ecwid)',
        run: async () => {
            try {
                const response = await axios.post(`${BASE_URL}/api/webhooks/ecwid`, {
                    eventId: 'order.created'
                }, { validateStatus: null });
                return response.status === 401 ? 'PASS' : `FAIL (Status: ${response.status})`;
            } catch (error) {
                return `ERROR (${error.message})`;
            }
        }
    },
    {
        name: 'Fix: Information Disclosure (/api/env)',
        run: async () => {
            try {
                // In production it should be 404. In dev it might be accessible but we secured it in index.js to return 404 if NODE_ENV=production.
                // Let's assume testing in "production" mode logic.
                const response = await axios.get(`${BASE_URL}/api/env`, { validateStatus: null });
                return response.status === 404 ? 'PASS' : `FAIL (Status: ${response.status})`;
            } catch (error) {
                return `ERROR (${error.message})`;
            }
        }
    },
    {
        name: 'Harden: Security Headers Check (Helmet)',
        run: async () => {
            try {
                const response = await axios.get(`${BASE_URL}/`);
                const headers = response.headers;
                const required = ['x-frame-options', 'x-content-type-options', 'strict-transport-security'];
                const missing = required.filter(h => !headers[h]);
                return missing.length === 0 ? 'PASS' : `FAIL (Missing: ${missing.join(', ')})`;
            } catch (error) {
                return `ERROR (${error.message})`;
            }
        }
    },
    {
        name: 'Harden: Rate Limiting Check',
        run: async () => {
            try {
                // Flooding health check (max 100 per minute)
                console.log('\n   [RateLimit] Sending 110 requests to /api/health...');
                let blocked = false;
                for (let i = 0; i < 110; i++) {
                    try {
                        const res = await axios.get(`${BASE_URL}/api/health`, { validateStatus: null });
                        if (res.status === 429) {
                            blocked = true;
                            break;
                        }
                    } catch (e) {
                        if (e.response?.status === 429) {
                            blocked = true;
                            break;
                        }
                    }
                }
                return blocked ? 'PASS (Rate limit triggered 429)' : 'FAIL (Rate limit not triggered after 110 requests)';
            } catch (error) {
                return `ERROR (${error.message})`;
            }
        }
    }
];

(async () => {
    console.log('--- Final Security Verification Test Suite ---');
    console.log(`Target: ${BASE_URL}\n`);

    for (const test of tests) {
        process.stdout.write(`[*] ${test.name}... `);
        const result = await test.run();
        console.log(result);
    }

    console.log('\n--- End of Verification ---');
})();
