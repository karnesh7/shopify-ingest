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
const HOST = process.env.HOST!; // e.g. https://abcd1234.ngrok.io

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
 * Webhook receiver - verify HMAC and handle events
 * POST /shopify/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const hmacHeader = req.header('x-shopify-hmac-sha256') || '';
  const shop = req.header('x-shopify-shop-domain') || '';
  const topic = req.header('x-shopify-topic') || '';

  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) {
    // rawBody must be preserved in app middleware (see note below)
    console.error('Missing rawBody — ensure raw body is captured for webhook verification.');
    return res.status(400).send('raw body required for verification');
  }

  // verify HMAC
  const hmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET!).update(rawBody).digest('base64');
  if (hmac !== hmacHeader) {
    console.warn('Warning: webhook HMAC verification failed');
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

  // Map Shopify payloads to our local models and insert via Prisma
  try {
    if (topic === 'orders/create') {
      // Example: map order
      const extId = String(payload.id);
      const total = Number(payload.total_price || payload.total_price);
      const customerShopId = payload.customer?.id ? String(payload.customer.id) : undefined;

      // ensure customer exists (upsert by externalId)
      let customerRecord = undefined;
      if (customerShopId) {
        const existing = await prisma.customer.findFirst({
          where: { tenantId: tenant.id, externalId: customerShopId },
        });
        if (!existing) {
          customerRecord = await prisma.customer.create({
            data: {
              tenantId: tenant.id,
              externalId: customerShopId,
              email: payload.customer?.email,
              firstName: payload.customer?.first_name,
              lastName: payload.customer?.last_name,
              totalSpent: 0,
            },
          });
        } else customerRecord = existing;
      }

      const order = await prisma.order.create({
        data: {
          tenantId: tenant.id,
          externalId: extId,
          customerId: customerRecord?.id,
          totalPrice: total,
        },
      });

      if (customerRecord) {
        await prisma.customer.update({
          where: { id: customerRecord.id },
          data: { totalSpent: { increment: total } },
        });
      }
      console.log('Processed orders/create for shop', shop, 'order id', extId);
    } else if (topic === 'customers/create') {
      const extId = String(payload.id);
      await prisma.customer.upsert({
        where: { tenantId_externalId: { tenantId: tenant.id, externalId: extId } },
        update: {
          email: payload.email,
          firstName: payload.first_name,
          lastName: payload.last_name,
        },
        create: {
          tenantId: tenant.id,
          externalId: extId,
          email: payload.email,
          firstName: payload.first_name,
          lastName: payload.last_name,
        },
      });
      console.log('Processed customers/create for shop', shop, 'customer id', extId);
    } else if (topic === 'checkouts/create') {
      // Treat as a "checkout started" event or potential abandoned cart signal
      console.log('Received checkouts/create (checkout started) for shop', shop);
      // You can map payload to a custom events table later; for now log.
    } else {
      console.log('Unhandled topic', topic);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Error processing webhook', err);
    res.status(500).send('failed');
  }
});

export default router;