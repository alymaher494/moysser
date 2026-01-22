const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const response = require('../utils/response');

/**
 * Checkout Flow Routes
 */

// Landing page for checkout redirection from Ecwid
router.get('/:orderId', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>جاري تحويلك للدفع...</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Tajawal', sans-serif;
                background-color: #0f172a;
                color: #f8fafc;
                margin: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                text-align: center;
            }
            .loader {
                width: 48px;
                height: 48px;
                border: 5px solid #FFF;
                border-bottom-color: #2563eb;
                border-radius: 50%;
                display: inline-block;
                box-sizing: border-box;
                animation: rotation 1s linear infinite;
                margin-bottom: 2rem;
            }
            @keyframes rotation {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            h1 { font-weight: 700; font-size: 1.5rem; margin-bottom: 1rem; }
            p { color: #94a3b8; }
        </style>
    </head>
    <body>
        <span class="loader"></span>
        <h1>جاري تجهيز عملية الدفع للطلب #${req.params.orderId}</h1>
        <p>يرجى الانتظار، سيتم تحويلك إلى بوابة ميسر خلال لحظات...</p>

        <script>
            // Automatically initiate payment creation via API
            fetch('/api/orders/${req.params.orderId}/pay', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data.transactionUrl) {
                    window.location.href = data.data.transactionUrl;
                } else {
                    document.body.innerHTML = \`
                        <h1 style="color: #ef4444">حدث خطأ أثناء التجهيز</h1>
                        <p>\${data.message || 'يرجى مراجعة إعدادات الـ API Key'}</p>
                        <a href="/" style="color: #2563eb; text-decoration: none; margin-top: 2rem; display: block;">العودة للرئيسية</a>
                    \`;
                }
            })
            .catch(err => {
                console.error(err);
                document.body.innerHTML = '<h1>حدث خطأ غير متوقع</h1>';
            });
        </script>
    </body>
    </html>
  `);
});

router.get('/payment/success', (req, res) => {
  res.send('<h1>تم الدفع بنجاح!</h1><p>شكراً لثقتك بنا.</p>');
});

router.get('/payment/failure', (req, res) => {
  res.send('<h1>فشلت عملية الدفع</h1><p>يرجى المحاولة مرة أخرى.</p>');
});

module.exports = router;
