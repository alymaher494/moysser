# Ecwid API Integration Guide

## Overview
This service integrates with the Ecwid REST API v3 to manage orders and payment statuses.

## Configuration
- **Base URL**: `https://app.ecwid.com/api/v3/{storeId}/`
- **Authentication**: Usage of `token` as a query parameter or header.

## Key Methods

### 1. Get Order Details
Fetches full order details including totals, customer info, and items.
```javascript
const order = await ecwid.getOrder(101);
```

### 2. Update Payment Status
Updates the order state in Ecwid after a payment event in Moyasar.
```javascript
await ecwid.updateOrderPaymentStatus(101, 'PAID', {
  transactionId: 'moy_payment_id',
  message: 'Payment confirmed via Moyasar'
});
```

## Webhooks
Ecwid can send webhooks for:
- `order.created`
- `order.updated`
- `order.payment_status.changed`

The integration uses `middlewares/ecwid-webhook.middleware.js` to ensure requests are authentic.
