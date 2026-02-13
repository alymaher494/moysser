const https = require('https');
const fs = require('fs');

const invoicesData = {
    merchantID: '7000000025',
    authenticationToken: 'ZGI2NThiZWZkOWNkOTE3OGIzNjY0NzQ0',
    invoicesDetails: [{
        invoiceID: 'NATV' + Date.now(),
        amount: '2',
        currency: '682',
        paymentDescription: 'Test Payment',
        customerID: 'TestCustomer',
        customerEmailAddress: 'test@example.com',
        language: 'ar',
        expiryperiod: '1D',
        notifyMe: 'no',
        generateQRCode: 'no'
    }]
};

const jsonStr = JSON.stringify(invoicesData);

async function test() {
    let results = '';

    // Test A: with encodeURIComponent
    try {
        const bodyA = 'invoices=' + encodeURIComponent(jsonStr);
        results += 'A body length: ' + bodyA.length + ', buffer length: ' + Buffer.byteLength(bodyA) + '\n';
        const resA = await makeRequest(bodyA);
        results += 'A (encoded): ' + resA + '\n\n';
    } catch (e) {
        results += 'A error: ' + e.message + '\n\n';
    }

    // Test B: WITHOUT encodeURIComponent but Content-Length matches
    try {
        const bodyB = 'invoices=' + jsonStr;
        results += 'B body length: ' + bodyB.length + ', buffer length: ' + Buffer.byteLength(bodyB) + '\n';
        const resB = await makeRequest(bodyB);
        results += 'B (raw): ' + resB + '\n\n';
    } catch (e) {
        results += 'B error: ' + e.message + '\n\n';
    }

    fs.writeFileSync('payone-test5.txt', results);
    console.log('Done!');
}

function makeRequest(body) {
    return new Promise((resolve, reject) => {
        const url = new URL('https://smartlinkdb-test.payone.io/URL2PayAdminWeb/rest/InvoicesService/createInvoice');
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

test();
