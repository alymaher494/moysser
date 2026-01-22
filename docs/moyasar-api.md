# Moyasar API Integration Guide

## Overview
Moyasar is a simplified payment gateway for Saudi Arabia. This service integrates the v1 API using Node.js.

## Base Configuration
- **Base URL**: `https://api.moyasar.com/v1/`
- **Authentication**: Basic Authentication (Secret Key as Username, empty Password).

## Usage Examples

### 1. Initialize Service
```javascript
const MoyasarService = require('../services/moyasar.service');
const moyasar = new MoyasarService(process.env.MOYASAR_API_KEY_TEST);
```

### 2. Create Payment (Credit Card)
```javascript
const payment = await moyasar.createPayment({
  amount: 100.50, // 100.50 SAR
  currency: 'SAR',
  description: 'Order #12345',
  callback_url: 'https://example.com/callback',
  source: {
    type: 'creditcard',
    name: 'Customer Name',
    number: '4111...',
    cvc: '123',
    month: '12',
    year: '2025'
  }
});
```

### 3. Response Structure
```json
{
  "id": "e668c2ee-...",
  "status": "initiated",
  "amount": 10050,
  "currency": "SAR",
  "description": "Order #12345",
  "source": {
    "type": "creditcard",
    "transaction_url": "https://api.moyasar.com/v1/payments/.../form"
  }
}
```

## Error Handling
The service throws `ApiError` with the status code and message returned from Moyasar. Ensure you wrap calls in `try/catch`.
