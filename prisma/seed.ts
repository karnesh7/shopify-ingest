// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DB...');

  // create or reuse tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-store' },
    update: {},
    create: {
      name: 'Acme Store',
      slug: 'acme-store',
      apiKey: 'd164897e4fca3a9d1cdb6a878ce8752bfd0c036f237f7e4e'
    }
  });

  console.log('Tenant id:', tenant.id);

  // create products
  const p1 = await prisma.product.upsert({
    where: { tenantId_externalId: { tenantId: tenant.id, externalId: 'prod-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      externalId: 'prod-1',
      title: 'Red Sneaker',
      sku: 'RSN-001',
      price: 79.99
    }
  });

  const p2 = await prisma.product.upsert({
    where: { tenantId_externalId: { tenantId: tenant.id, externalId: 'prod-2' } },
    update: {},
    create: {
      tenantId: tenant.id,
      externalId: 'prod-2',
      title: 'Blue Hoodie',
      sku: 'BHD-001',
      price: 49.5
    }
  });

  // customers
  const c1 = await prisma.customer.upsert({
    where: { tenantId_externalId: { tenantId: tenant.id, externalId: 'cust-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      externalId: 'cust-1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Anderson'
    }
  });

  const c2 = await prisma.customer.upsert({
    where: { tenantId_externalId: { tenantId: tenant.id, externalId: 'cust-2' } },
    update: {},
    create: {
      tenantId: tenant.id,
      externalId: 'cust-2',
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Brown'
    }
  });

  // orders
  await prisma.order.upsert({
    where: { tenantId_externalId: { tenantId: tenant.id, externalId: 'ord-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      externalId: 'ord-1',
      customerId: c1.id,
      totalPrice: 79.99
    }
  });

  await prisma.order.upsert({
    where: { tenantId_externalId: { tenantId: tenant.id, externalId: 'ord-2' } },
    update: {},
    create: {
      tenantId: tenant.id,
      externalId: 'ord-2',
      customerId: c2.id,
      totalPrice: 49.5
    }
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
