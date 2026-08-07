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

    // Defensive check
    if (!tenant) {
      console.error('Failed to upsert tenant for', shop);
      return res.status(500).send('failed to create tenant');
    }

    // Extract values you will use in nested functions to preserve non-null typing
    const tenantId = tenant.id;
    const tenantApiKey = tenant.apiKey;


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

import { enqueueWebhookJob } from '../queue/ingestQueue';

/**
 * Webhook receiver - verify HMAC and enqueue to tenant-isolated async queue.
 * Responds in < 10ms with 200 OK.
 * POST /shopify/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const hmacHeader = req.header('x-shopify-hmac-sha256') || '';
  const shop = req.header('x-shopify-shop-domain') || '';
  const topic = req.header('x-shopify-topic') || '';
  const webhookIdHeader = req.header('x-shopify-webhook-id') || '';

  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) {
    console.error('Missing rawBody — ensure raw body is captured for webhook verification.');
    return res.status(400).send('raw body required for verification');
  }

  // verify HMAC
  const expectedHmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET!).update(rawBody).digest('base64');
  if (expectedHmac !== hmacHeader) {
    console.warn('Webhook HMAC verification failed', { expected: expectedHmac, got: hmacHeader });
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

  // Find or create tenant by shop domain
  try {
    const slug = (shop as string).split('.')[0];
    const tenant = await prisma.tenant.upsert({
      where: { slug },
      update: {
        shopDomain: shop as string,
        accessToken: undefined as any,
      },
      create: {
        name: `${slug} (Shopify)`,
        slug,
        apiKey: crypto.randomBytes(24).toString('hex'),
        shopDomain: shop as string,
      },
    });

    if (!tenant) {
      console.error('Failed to upsert tenant for', shop);
      return res.status(500).send('failed to upsert tenant');
    }

    const idempotencyKey = webhookIdHeader || `shopify-${topic}-${payload.id || Date.now()}`;

    // Offload to tenant-isolated asynchronous queue
    const queueResult = await enqueueWebhookJob({
      tenantId: tenant.id,
      shopDomain: shop as string,
      topic,
      payload,
      receivedAt: new Date().toISOString(),
      idempotencyKey,
    });

    return res.status(200).json({
      status: 'acknowledged',
      queued: queueResult.queued,
      jobId: queueResult.jobId,
      engine: queueResult.engine,
      tenantId: tenant.id,
      shop,
    });
  } catch (err: any) {
    console.error('Webhook enqueue error:', err);
    return res.status(500).json({ error: 'could not enqueue webhook', details: err?.message });
  }
});

/**
 * Developer Simulator Endpoint: simulate a Shopify webhook for a tenant
 * POST /shopify/simulate-webhook
 */
router.post('/simulate-webhook', async (req: Request, res: Response) => {
  try {
    const { shopDomain, topic = 'orders/create', payload } = req.body;
    if (!shopDomain || !payload) {
      return res.status(400).json({ error: 'shopDomain and payload required' });
    }

    const slug = String(shopDomain).split('.')[0];
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ shopDomain }, { slug }] },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant not found for domain ' + shopDomain });
    }

    const idempotencyKey = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const queueResult = await enqueueWebhookJob({
      tenantId: tenant.id,
      shopDomain: tenant.shopDomain || shopDomain,
      topic,
      payload,
      receivedAt: new Date().toISOString(),
      idempotencyKey,
    });

    return res.status(200).json({
      status: 'simulated_and_enqueued',
      jobId: queueResult.jobId,
      engine: queueResult.engine,
      tenant: tenant.name,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'simulation error', details: err?.message });
  }
});



/**
 * Bulk sync all customers, products, and orders from Shopify REST API
 * GET /shopify/sync/:shop   e.g. /shopify/sync/project-dev.myshopify.com
 */
router.get('/sync/:shop', async (req: Request, res: Response) => {
  const shop = req.params.shop;

  // Look up tenant by shop domain
  const tenant = await prisma.tenant.findUnique({ where: { shopDomain: shop } });
  if (!tenant) {
    return res.status(404).json({ error: `No tenant found for shop: ${shop}. Install the app first.` });
  }
  if (!tenant.accessToken) {
    return res.status(400).json({ error: `Tenant found but no accessToken stored. Re-install the app.` });
  }

  const accessToken = tenant.accessToken;
  const tenantId = tenant.id;
  const headers = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
  const apiBase = `https://${shop}/admin/api/2024-07`;

  const results: Record<string, { synced: number; errors: number }> = {
    customers: { synced: 0, errors: 0 },
    products: { synced: 0, errors: 0 },
    orders: { synced: 0, errors: 0 },
  };

  try {
    // ---- SYNC CUSTOMERS ----
    const customersRes = await axios.get(`${apiBase}/customers.json?limit=250`, { headers });
    const shopifyCustomers: any[] = customersRes.data.customers || [];
    for (const c of shopifyCustomers) {
      try {
        await prisma.customer.upsert({
          where: { tenantId_externalId: { tenantId, externalId: String(c.id) } },
          update: { email: c.email, firstName: c.first_name, lastName: c.last_name },
          create: {
            tenantId,
            externalId: String(c.id),
            email: c.email,
            firstName: c.first_name,
            lastName: c.last_name,
          },
        });
        results.customers.synced++;
      } catch (e) {
        console.warn('Customer upsert failed:', c.id, e);
        results.customers.errors++;
      }
    }

    // ---- SYNC PRODUCTS ----
    const productsRes = await axios.get(`${apiBase}/products.json?limit=250`, { headers });
    const shopifyProducts: any[] = productsRes.data.products || [];
    for (const p of shopifyProducts) {
      // each Shopify product can have multiple variants — sync each variant as a product record
      for (const variant of (p.variants || [{ id: p.id, sku: '', price: 0 }])) {
        try {
          await prisma.product.upsert({
            where: { tenantId_externalId: { tenantId, externalId: String(variant.id) } },
            update: { title: p.title, sku: variant.sku || null, price: parseFloat(variant.price) || 0 },
            create: {
              tenantId,
              externalId: String(variant.id),
              title: p.title,
              sku: variant.sku || null,
              price: parseFloat(variant.price) || 0,
            },
          });
          results.products.synced++;
        } catch (e) {
          console.warn('Product upsert failed:', variant.id, e);
          results.products.errors++;
        }
      }
    }

    // ---- SYNC ORDERS ----
    const ordersRes = await axios.get(`${apiBase}/orders.json?limit=250&status=any`, { headers });
    const shopifyOrders: any[] = ordersRes.data.orders || [];
    for (const o of shopifyOrders) {
      try {
        // Try to find the linked customer
        let customerId: number | null = null;
        if (o.customer?.id) {
          const cust = await prisma.customer.findFirst({
            where: { tenantId, externalId: String(o.customer.id) },
          });
          if (cust) customerId = cust.id;
        }

        await prisma.order.upsert({
          where: { tenantId_externalId: { tenantId, externalId: String(o.id) } },
          update: { totalPrice: parseFloat(o.total_price) || 0, customerId },
          create: {
            tenantId,
            externalId: String(o.id),
            customerId,
            totalPrice: parseFloat(o.total_price) || 0,
            createdAt: new Date(o.created_at),
          },
        });

        // Update customer totalSpent if linked
        if (customerId) {
          await prisma.customer.update({
            where: { id: customerId },
            data: { totalSpent: { increment: parseFloat(o.total_price) || 0 } },
          });
        }

        results.orders.synced++;
      } catch (e) {
        console.warn('Order upsert failed:', o.id, e);
        results.orders.errors++;
      }
    }

    console.log(`Sync complete for ${shop}:`, results);
    return res.json({ success: true, shop, tenantId, results });

  } catch (err: any) {
    console.error('Sync error:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Sync failed', details: err?.response?.data || err.message });
  }
});

export default router;