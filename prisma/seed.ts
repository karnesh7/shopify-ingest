// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function randomDateBetween(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomFloat(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

async function main() {
  console.log("Seeding DB with year-wide data...");

  const tenant = await prisma.tenant.upsert({
    where: { slug: "xeno-test-126" },
    update: {},
    create: {
      name: "xeno-test-126 (Shopify)",
      slug: "xeno-test-126",
      apiKey: "d164897e4fca3a9d1cdb6a878ce8752bfd0c036f237f7e4e"
    }
  });

  console.log("Tenant:", tenant.id);

  // ----- PRODUCTS -----
  const productsData = [
    { externalId: "prod-1", title: "Red Sneaker", sku: "RSN-001", price: 79.99 },
    { externalId: "prod-2", title: "Blue Hoodie", sku: "BHD-001", price: 49.50 },
    { externalId: "prod-3", title: "White Tee", sku: "WT-001", price: 19.99 },
    { externalId: "prod-4", title: "Black Jeans", sku: "BJ-001", price: 59.90 },
    { externalId: "prod-5", title: "Cap", sku: "CAP-001", price: 14.99 }
  ];

  const products = [];
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { tenantId_externalId: { tenantId: tenant.id, externalId: p.externalId } },
      update: {},
      create: { ...p, tenantId: tenant.id }
    });
    products.push(prod);
  }

  // ----- CUSTOMERS -----
  const customersData = [
    { externalId: "cust-1", email: "alice@example.com", firstName: "Alice", lastName: "Anderson" },
    { externalId: "cust-2", email: "bob@example.com", firstName: "Bob", lastName: "Brown" },
    { externalId: "cust-3", email: "chris@example.com", firstName: "Chris", lastName: "Carter" },
    { externalId: "cust-4", email: "diana@example.com", firstName: "Diana", lastName: "Dawson" },
    { externalId: "cust-5", email: "eve@example.com", firstName: "Eve", lastName: "Evans" }
  ];

  const customers = [];
  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { tenantId_externalId: { tenantId: tenant.id, externalId: c.externalId } },
      update: {},
      create: { ...c, tenantId: tenant.id }
    });
    customers.push(cust);
  }

  // ----- ORDERS (YEAR-WIDE RANDOM DATA) -----
  const now = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(now.getFullYear() - 1);

  const TOTAL_ORDERS = 200;

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const createdAt = randomDateBetween(lastYear, now);
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const product = products[Math.floor(Math.random() * products.length)];

    const totalPrice = randomFloat(product.price * 0.8, product.price * 1.2);

    await prisma.order.upsert({
      where: {
        tenantId_externalId: {
          tenantId: tenant.id,
          externalId: `order-${i + 1}`
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        externalId: `order-${i + 1}`,
        customerId: customer.id,
        totalPrice,
        createdAt
      }
    });
    // increment customer totalSpent
    await prisma.customer.update({
      where: { id: customer.id },
      data: { totalSpent: { increment: totalPrice } }
    });
  }

  console.log("Seed complete: 200 random orders created across the year.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });