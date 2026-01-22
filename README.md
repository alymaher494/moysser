# Moyasar & Ecwid Payment Integration Bridge

A robust, production-ready integration bridge between the **Moyasar Payment Gateway** and the **Ecwid E-commerce Platform**. Built with **Node.js/Express**, optimized for **Vercel Serverless Functions**.

## 🚀 Overview

This project serves as a middle layer that handles the checkout flow, payment processing through Moyasar, and automatic synchronization of order statuses in Ecwid.

### Key Features
- **Seamless Checkout**: Custom checkout flow that bridges Ecwid orders to Moyasar payments.
- **Automatic Status Sync**: Real-time order status updates in Ecwid via Moyasar Webhooks.
- **Support for Multiple Payment Methods**: Credit Cards, Apple Pay, and STC Pay.
- **Robust Error Handling**: Standardized API responses and detailed logging.
- **Serverless Optimized**: Designed for zero-configuration deployment on Vercel.
- **Security**: Signature verification for webhooks and API key protection.

---

## 📋 System Requirements
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Git**: For version control
- **Vercel Account**: For deployment (optional but recommended)
- **Moyasar Account**: Test/Live API keys
- **Ecwid Store**: Access to Ecwid API and Custom Apps

---

## 🛠 Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/moyasar-ecwid-integration.git
cd moyasar-ecwid-integration
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy the `.env.example` file to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 4. Local Development
```bash
npm run dev
```
The server will start at `http://localhost:3000`.

---

## ⚙️ Environment Variables

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `MOYASAR_API_KEY_TEST` | Secret Key for Sandbox | Moyasar Dashboard > API Keys |
| `MOYASAR_API_KEY_LIVE` | Secret Key for Production | Moyasar Dashboard > API Keys |
| `ECWID_STORE_ID` | Your Ecwid Store ID | Ecwid Panel > Bottom Left |
| `ECWID_TOKEN` | Secret API Token | Ecwid Panel > Apps > My Apps |
| `APP_API_KEY` | Custom Key for your API | Generate it yourself (random string) |

---

## 🔌 Integration Steps

### 1. Ecwid Configuration
To redirect customers to the payment bridge, go to **Ecwid Control Panel > Design**:
1. Disable the default "Payment Method" if you want to use a custom redirect.
2. Add a Custom App or use a script in the "Thank You" page to redirect based on payment status:
   ```javascript
   if (Ecwid.getCart().paymentStatus === 'AWAITING_PAYMENT') {
     const orderId = Ecwid.getCart().orderId;
     window.location.href = `https://your-app.vercel.app/checkout/${orderId}`;
   }
   ```

### 2. Moyasar Webhook Setup
1. Go to **Moyasar Dashboard > Settings > Webhooks**.
2. Add a new webhook targeting: `https://your-app.vercel.app/api/webhooks/moyasar`.
3. Select the `payment.paid` and `payment.failed` events.

---

## 📑 API Documentation

### Base URL
`https://your-app.vercel.app/api`

### Endpoints
- **GET /health**: System health check.
- **POST /orders/:id/pay**: Initiates a payment for an Ecwid order.
- **POST /webhooks/moyasar**: Receives payment notifications from Moyasar.
- **GET /checkout/:orderId**: Customer-facing redirection page.

---

## 🐳 Running with Docker
```bash
docker-compose up -d
```

---

## 🐞 Troubleshooting
- **401 Unauthorized**: Check your `APP_API_KEY` header or Moyasar secret key.
- **Order Not Syncing**: Verify that the `ECWID_TOKEN` has `edit_orders` permissions.
- **Webhook 500 Error**: Check logs on Vercel to see if the metadata contains the correct `order_id`.

---

## 📄 License
This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing
Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
