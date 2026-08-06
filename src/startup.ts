// src/startup.ts
// Runs once on server start:
//   1. Syncs all tenant stores with latest data from Shopify REST API
//   2. Re-registers webhooks pointing to the current HOST (ngrok URL)

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOST = process.env.HOST || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

const WEBHOOK_TOPICS = ['orders/create', 'customers/create', 'checkouts/create'];

async function syncTenantData(tenantId: number, shop: string, accessToken: string) {
  const headers = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
  const apiBase = `https://${shop}/admin/api/2024-07`;
  let synced = { customers: 0, products: 0, orders: 0 };

  // ---- CUSTOMERS (independent - may 403 on dev stores without Protected Customer Data approval) ----
  try {
    const { data: custData } = await axios.get(`${apiBase}/customers.json?limit=250`, { headers });
    for (const c of (custData.customers || [])) {
      await prisma.customer.upsert({
        where: { tenantId_externalId: { tenantId, externalId: String(c.id) } },
        update: { email: c.email, firstName: c.first_name, lastName: c.last_name },
        create: { tenantId, externalId: String(c.id), email: c.email, firstName: c.first_name, lastName: c.last_name },
      }).catch(() => null);
      synced.customers++;
    }
  } catch (err: any) {
    if (err?.response?.status === 403) {
      console.warn(`  ⚠ [${shop}] Customers: Shopify requires Protected Customer Data approval. Skipping.`);
      console.warn(`       See: https://shopify.dev/docs/apps/launch/protected-customer-data`);
    } else {
      console.warn(`  ⚠ [${shop}] Customers sync failed: ${err?.response?.data?.errors || err.message}`);
    }
  }

  // ---- PRODUCTS (independent) ----
  try {
    const { data: prodData } = await axios.get(`${apiBase}/products.json?limit=250`, { headers });
    for (const p of (prodData.products || [])) {
      for (const variant of (p.variants || [])) {
        await prisma.product.upsert({
          where: { tenantId_externalId: { tenantId, externalId: String(variant.id) } },
          update: { title: p.title, sku: variant.sku || null, price: parseFloat(variant.price) || 0 },
          create: { tenantId, externalId: String(variant.id), title: p.title, sku: variant.sku || null, price: parseFloat(variant.price) || 0 },
        }).catch(() => null);
        synced.products++;
      }
    }
  } catch (err: any) {
    console.warn(`  ⚠ [${shop}] Products sync failed: ${err?.response?.data?.errors || err.message}`);
  }

  // ---- ORDERS (independent - status=any needs read_all_orders; use open+closed instead) ----
  try {
    const { data: orderData } = await axios.get(`${apiBase}/orders.json?limit=250`, { headers });
    const orders: any[] = orderData.orders || [];
    console.log(`  ℹ [${shop}] Orders returned from Shopify API: ${orders.length}`);
    for (const o of orders) {
      let customerId: number | null = null;
      if (o.customer?.id) {
        const cust = await prisma.customer.findFirst({ where: { tenantId, externalId: String(o.customer.id) } });
        if (cust) customerId = cust.id;
      }
      await prisma.order.upsert({
        where: { tenantId_externalId: { tenantId, externalId: String(o.id) } },
        update: { totalPrice: parseFloat(o.total_price) || 0, customerId },
        create: { tenantId, externalId: String(o.id), customerId, totalPrice: parseFloat(o.total_price) || 0, createdAt: new Date(o.created_at) },
      }).catch((e: any) => console.warn(`  ⚠ Order upsert error (${o.id}):`, e?.message));

      if (customerId) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { totalSpent: { increment: parseFloat(o.total_price) || 0 } },
        }).catch(() => null);
      }
      synced.orders++;
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const body = JSON.stringify(err?.response?.data || {});
    if (status === 403) {
      console.warn(`  ⚠ [${shop}] Orders: 403 Forbidden — likely Protected Customer Data restriction.`);
      console.warn(`       See: https://shopify.dev/docs/apps/launch/protected-customer-data`);
    } else {
      console.warn(`  ⚠ [${shop}] Orders sync failed (HTTP ${status}): ${err.message}`);
      console.warn(`       Response: ${body}`);
    }
  }

  // Always print final tally
  console.log(`  ✓ [${shop}] Synced: ${synced.customers} customers, ${synced.products} products, ${synced.orders} orders`);
}

async function refreshWebhooks(shop: string, accessToken: string) {
  if (!HOST) {
    console.warn('  ⚠ HOST not set in .env — skipping webhook registration');
    return;
  }

  const headers = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
  const webhookAddress = `${HOST}/shopify/webhook`;

  // Fetch existing webhooks
  let existing: any[] = [];
  try {
    const { data } = await axios.get(`https://${shop}/admin/api/2024-07/webhooks.json`, { headers });
    existing = data.webhooks || [];
  } catch (err: any) {
    console.warn(`  ⚠ [${shop}] Could not fetch existing webhooks: ${err.message}`);
  }

  for (const topic of WEBHOOK_TOPICS) {
    const existingHook = existing.find((w: any) => w.topic === topic);

    if (existingHook) {
      // Update the address if it has changed (e.g. new ngrok URL)
      if (existingHook.address !== webhookAddress) {
        try {
          await axios.put(
            `https://${shop}/admin/api/2024-07/webhooks/${existingHook.id}.json`,
            { webhook: { id: existingHook.id, address: webhookAddress } },
            { headers }
          );
          console.log(`  ↻ [${shop}] Updated webhook: ${topic} → ${webhookAddress}`);
        } catch (err: any) {
          console.warn(`  ⚠ [${shop}] Could not update webhook ${topic}: ${err?.response?.data?.errors || err.message}`);
        }
      } else {
        console.log(`  ✓ [${shop}] Webhook already current: ${topic}`);
      }
    } else {
      // Create new webhook
      try {
        await axios.post(
          `https://${shop}/admin/api/2024-07/webhooks.json`,
          { webhook: { topic, address: webhookAddress, format: 'json' } },
          { headers }
        );
        console.log(`  ✓ [${shop}] Registered webhook: ${topic}`);
      } catch (err: any) {
        console.warn(`  ⚠ [${shop}] Could not register webhook ${topic}: ${err?.response?.data?.errors || err.message}`);
      }
    }
  }
}

export async function runStartupSync() {
  console.log('\n🔄 Running startup sync with Shopify stores...');

  // Find all tenants that have a Shopify store connected
  const tenants = await prisma.tenant.findMany({
    where: { shopDomain: { not: null }, accessToken: { not: null } },
  });

  if (tenants.length === 0) {
    console.log('  No connected Shopify stores found. Install the app first.\n');
    return;
  }

  for (const tenant of tenants) {
    const shop = tenant.shopDomain!;
    const accessToken = tenant.accessToken!;
    console.log(`\n📦 Syncing store: ${shop} (tenantId: ${tenant.id})`);
    await syncTenantData(tenant.id, shop, accessToken);
    await refreshWebhooks(shop, accessToken);
  }

  console.log('\n✅ Startup sync complete.\n');
}
