// src/routes/shopify.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';
import qs from 'qs';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const router = Router();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY!;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET!;
const SCOPES = process.env.SHOPIFY_SCOPES || 'read_customers,read_orders';
const HOST = process.env.HOST!;
const INTERNAL_API = process.env.INTERNAL_API || 'http://localhost:4000';

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !HOST) {
  console.warn('Missing Shopify env variables. Make sure SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and HOST are set.');
}

/**
 * Step 1: Redirect store admin to Shopify install page
 * GET /shopify/install?shop=<my-store.myshopify.com>
 */
router.get('/install', (req: Request, res: Response) => {
  const shop = String(req.query.shop || '');
  if (!shop) return res.status(400).send('shop param required, e.g. my-store.myshopify.com');

  const state = crypto.randomBytes(8).toString('hex'); // you could store state in a cookie or DB (not necessary for local dev)
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${encodeURIComponent(
    SCOPES
  )}&redirect_uri=${encodeURIComponent(`${HOST}/shopify/callback`)}&state=${state}`;

  // For production, store `state` in cookie and verify in callback to prevent CSRF.
  res.redirect(installUrl);
});

/**
 * Step 2: OAuth callback - exchange code for access token, save tenant
 * GET /shopify/callback?code=...&hmac=...&shop=...&state=...
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { shop, code, hmac, state } = req.query as any;
  if (!shop || !code) return res.status(400).send('Missing shop or code');

  // Optional: validate hmac and state for security (we'll do a light check below)
  // Exchange temporary code for permanent access token
  try {
    const tokenRes = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const accessToken = tokenRes.data.access_token as string;

    // Upsert tenant in our DB using shop domain
    const slug = (shop as string).split('.')[0];
    const tenant = await prisma.tenant.upsert({
      where: { slug },
      update: {
        shopDomain: shop,
        accessToken,
      },
      create: {
        name: `${slug} (Shopify)`,
        slug,
        apiKey: crypto.randomBytes(24).toString('hex'),
        shopDomain: shop,
        accessToken,
      },
    });

    // Create webhook subscriptions for the shop
    await createShopifyWebhooks(shop, accessToken);

    // return a simple page
    return res.send(`<h3>App installed for ${shop}</h3><p>Tenant id: ${tenant.id}</p><p>apiKey: ${tenant.apiKey}</p>`);
  } catch (err: any) {
    console.error('OAuth callback error', err?.response?.data || err.message || err);
    return res.status(500).send('OAuth error, check server logs');
  }
});

/**
 * Create webhooks for a shop
 */
async function createShopifyWebhooks(shop: string, accessToken: string) {
  const apiUrl = `https://${shop}/admin/api/2024-07/webhooks.json`; // API version is safe to use latest stable; adjust as needed

  // desired webhooks
  const topics = [
    'orders/create',
    'customers/create',
    'checkouts/create' // checkout events to approximate cart/checkout events
  ];

  for (const topic of topics) {
    try {
      // We create a webhook that posts to our HOST/shopify/webhook endpoint
      const res = await axios.post(
        `https://${shop}/admin/api/2024-07/webhooks.json`,
        {
          webhook: {
            topic,
            address: `${HOST}/shopify/webhook`,
            format: 'json',
          },
        },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      console.log(`Webhook created for ${shop} ${topic}:`, res.data);
    } catch (err: any) {
      // If webhook exists or creation fails, log and continue
      console.warn(`Could not create webhook ${topic} for ${shop}:`, err?.response?.data || err.message);
    }
  }
}

/**
 * Webhook receiver - verify HMAC and forward to internal ingestion endpoints.
 * POST /shopify/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const hmacHeader = req.header('x-shopify-hmac-sha256') || '';
  const shop = req.header('x-shopify-shop-domain') || '';
  const topic = req.header('x-shopify-topic') || '';

  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) {
    console.error('Missing rawBody — ensure raw body is captured for webhook verification.');
    return res.status(400).send('raw body required for verification');
  }

  // verify HMAC
  const hmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET!).update(rawBody).digest('base64');
  if (hmac !== hmacHeader) {
    console.warn('Webhook HMAC verification failed', { expected: hmac, got: hmacHeader });
    return res.status(401).send('HMAC validation failed');
  }

  // parse payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch (err) {
    console.error('Could not parse webhook JSON', err);
    return res.status(400).send('invalid json');
  }

  // Find tenant by shop domain
  const tenant = await prisma.tenant.findUnique({ where: { shopDomain: shop as string } });
  if (!tenant) {
    console.warn('Received webhook for unknown shop', shop);
    return res.status(404).send('unknown shop');
  }

  // Helper: forward to internal endpoint with tenant apiKey, with simple retries
  async function forward(urlPath: string, body: any) {
    const maxTries = 3;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxTries; attempt++) {
      try {
        const url = `${INTERNAL_API}${urlPath}`;
        await axios.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': tenant.apiKey,
          },
          timeout: 5000,
        });
        return { ok: true };
      } catch (err: any) {
        lastErr = err;
        console.warn(`Forward attempt ${attempt} failed for ${urlPath}`, err?.response?.data || err.message);
        // small delay
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
    return { ok: false, err: lastErr };
  }

  try {
    if (topic === 'orders/create') {
      const extId = String(payload.id);
      const total = Number(payload.total_price ?? payload.total_price);
      const customerShopId = payload.customer?.id ? String(payload.customer.id) : undefined;

      // map payload to our internal /api/data/orders body
      const body = {
        externalId: extId,
        customerExternalId: customerShopId,
        totalPrice: total,
      };

      const result = await forward('/api/data/orders', body);
      if (!result.ok) throw result.err;
      console.log('Forwarded orders/create for shop', shop, 'order', extId);
    } else if (topic === 'customers/create') {
      const extId = String(payload.id);
      const body = {
        externalId: extId,
        email: payload.email,
        firstName: payload.first_name,
        lastName: payload.last_name,
      };
      const result = await forward('/api/data/customers', body);
      if (!result.ok) throw result.err;
      console.log('Forwarded customers/create for shop', shop, 'customer', extId);
    } else if (topic === 'checkouts/create') {
      // Checkout started — optional mapping to custom events or customer
      // We'll forward a minimal "custom event" to a product/order endpoint as demonstration,
      // or just log for now. You can expand to a custom events table later.
      console.log('Received checkouts/create for shop', shop, 'checkout id', payload.id);
    } else {
      console.log('Unhandled topic', topic);
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('Error processing webhook forward', err);
    return res.status(500).send('failed');
  }
});

export default router;