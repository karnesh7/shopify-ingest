/**
 * scripts/seed-tenant.ts
 *
 * Seeds realistic customers, products and orders for a specific Shopify tenant.
 * Use this to populate test data for your dev store when the Shopify REST API
 * is blocked by Protected Customer Data restrictions.
 *
 * Usage:
 *   ts-node scripts/seed-tenant.ts [shopDomain]
 *   ts-node scripts/seed-tenant.ts project-dev-yokizqqo.myshopify.com
 *
 * If no shopDomain is given, it targets the first tenant with a shopDomain set.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
function randomDateInPastYear() {
  const now = Date.now();
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
  return new Date(yearAgo + Math.random() * (now - yearAgo));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CUSTOMERS = [
  { externalId: 'ext-cust-1', email: 'alice@example.com',   firstName: 'Alice',   lastName: 'Anderson' },
  { externalId: 'ext-cust-2', email: 'bob@example.com',     firstName: 'Bob',     lastName: 'Brown'    },
  { externalId: 'ext-cust-3', email: 'charlie@example.com', firstName: 'Charlie', lastName: 'Clark'    },
  { externalId: 'ext-cust-4', email: 'diana@example.com',   firstName: 'Diana',   lastName: 'Davis'    },
  { externalId: 'ext-cust-5', email: 'eve@example.com',     firstName: 'Eve',     lastName: 'Evans'    },
  { externalId: 'ext-cust-6', email: 'frank@example.com',   firstName: 'Frank',   lastName: 'Foster'   },
  { externalId: 'ext-cust-7', email: 'grace@example.com',   firstName: 'Grace',   lastName: 'Green'    },
  { externalId: 'ext-cust-8', email: 'henry@example.com',   firstName: 'Henry',   lastName: 'Harris'   },
];

const PRODUCTS = [
  { externalId: 'ext-prod-1', title: 'Classic White Tee',   sku: 'CWT-001', price: 24.99 },
  { externalId: 'ext-prod-2', title: 'Slim Fit Jeans',      sku: 'SFJ-001', price: 69.90 },
  { externalId: 'ext-prod-3', title: 'Leather Sneakers',    sku: 'LSN-001', price: 119.00 },
  { externalId: 'ext-prod-4', title: 'Wool Hoodie',         sku: 'WHD-001', price: 89.50 },
  { externalId: 'ext-prod-5', title: 'Canvas Backpack',     sku: 'CBP-001', price: 54.99 },
  { externalId: 'ext-prod-6', title: 'Ceramic Coffee Mug',  sku: 'CCM-001', price: 18.00 },
  { externalId: 'ext-prod-7', title: 'Wireless Earbuds',    sku: 'WEB-001', price: 149.99 },
  { externalId: 'ext-prod-8', title: 'Yoga Mat',            sku: 'YGM-001', price: 39.95 },
];

const TOTAL_ORDERS = 150;

async function main() {
  const targetDomain = process.argv[2] || null;

  // Find the tenant
  const tenant = targetDomain
    ? await prisma.tenant.findUnique({ where: { shopDomain: targetDomain } })
    : await prisma.tenant.findFirst({ where: { shopDomain: { not: null } } });

  if (!tenant) {
    console.error('❌ Tenant not found. Install the app first so the tenant record exists.');
    process.exit(1);
  }

  console.log(`\n🌱 Seeding tenant: "${tenant.name}" (id=${tenant.id}, shop=${tenant.shopDomain})`);
  const tenantId = tenant.id;

  // ---- CUSTOMERS ----
  console.log('\n👤 Creating customers...');
  const createdCustomers = [];
  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { tenantId_externalId: { tenantId, externalId: c.externalId } },
      update: { email: c.email, firstName: c.firstName, lastName: c.lastName },
      create: { tenantId, ...c },
    });
    createdCustomers.push(customer);
    console.log(`  ✓ ${c.firstName} ${c.lastName} (${c.email})`);
  }

  // ---- PRODUCTS ----
  console.log('\n📦 Creating products...');
  const createdProducts = [];
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { tenantId_externalId: { tenantId, externalId: p.externalId } },
      update: { title: p.title, sku: p.sku, price: p.price },
      create: { tenantId, ...p },
    });
    createdProducts.push(product);
    console.log(`  ✓ ${p.title} — $${p.price}`);
  }

  // ---- ORDERS ----
  console.log(`\n🛒 Creating ${TOTAL_ORDERS} orders spread across the past year...`);

  // Reset totalSpent for all customers in this tenant first
  await prisma.customer.updateMany({
    where: { tenantId },
    data: { totalSpent: 0 },
  });

  let orderCount = 0;
  for (let i = 1; i <= TOTAL_ORDERS; i++) {
    const customer = pick(createdCustomers);
    const product = pick(createdProducts);
    const quantity = randomBetween(1, 3);
    const totalPrice = randomFloat(product.price * quantity * 0.85, product.price * quantity * 1.1);
    const createdAt = randomDateInPastYear();

    await prisma.order.upsert({
      where: { tenantId_externalId: { tenantId, externalId: `seed-order-t${tenantId}-${i}` } },
      update: { totalPrice, customerId: customer.id },
      create: {
        tenantId,
        externalId: `seed-order-t${tenantId}-${i}`,
        customerId: customer.id,
        totalPrice,
        createdAt,
      },
    });

    // Update customer totalSpent
    await prisma.customer.update({
      where: { id: customer.id },
      data: { totalSpent: { increment: totalPrice } },
    });

    orderCount++;
  }

  console.log(`  ✓ ${orderCount} orders created`);

  // ---- SUMMARY ----
  const [custCount, prodCount, ordCount] = await Promise.all([
    prisma.customer.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.order.count({ where: { tenantId } }),
  ]);

  console.log(`\n✅ Seeding complete for tenant "${tenant.name}":`);
  console.log(`   Customers : ${custCount}`);
  console.log(`   Products  : ${prodCount}`);
  console.log(`   Orders    : ${ordCount}`);
  console.log(`\n   API Key   : ${tenant.apiKey}`);
  console.log(`   Use this apiKey in your dashboard at http://localhost:3000/dashboard\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
