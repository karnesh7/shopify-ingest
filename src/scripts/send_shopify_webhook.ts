// scripts/send_shopify_webhook.ts
/**
 * Usage:
 *  node scripts/send_shopify_webhook.ts orders_create
 *  node scripts/send_shopify_webhook.ts customers_create
 *
 * This script reads a sample payload and sends it to /shopify/webhook with proper HMAC.
 */
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET || '';
const WEBHOOK_TARGET = process.env.WEBHOOK_TARGET || 'http://localhost:4000/shopify/webhook';
const SHOP_DOMAIN = process.env.TEST_SHOP_DOMAIN || 'xeno-test-126.myshopify.com';

if (!SHOPIFY_SECRET) {
  console.error('Set SHOPIFY_API_SECRET in env to compute HMAC.');
  process.exit(1);
}

const arg = process.argv[2] || 'orders_create';

function samplePayload(kind: string) {
  if (kind === 'orders_create') {
    return {
      id: 999999,
      total_price: '123.45',
      customer: { id: 555, email: 'sim@example.com', first_name: 'Sim', last_name: 'Tester' }
    };
  }
  if (kind === 'customers_create') {
    return {
      id: 555,
      email: 'sim@example.com',
      first_name: 'Sim',
      last_name: 'Tester'
    };
  }
  return { msg: 'unknown' };
}

async function main() {
  const payload = samplePayload(arg);
  const raw = Buffer.from(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', SHOPIFY_SECRET).update(raw).digest('base64');

  try {
    const res = await axios.post(WEBHOOK_TARGET, raw, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': SHOP_DOMAIN,
        'X-Shopify-Topic': arg.replace('_', '/'),
      },
      timeout: 10000
    });
    console.log('Webhook sent, status', res.status, res.data);
  } catch (err: any) {
    console.error('Send failed', err?.response?.status, err?.response?.data || err.message);
  }
}

main();
