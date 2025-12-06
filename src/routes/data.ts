// src/routes/data.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireTenant } from '../middleware/tenant';

const prisma = new PrismaClient();
const router = Router();

/**
 * Protected routes: require x-api-key header
 */
router.use(requireTenant);

/**
 * POST /api/data/customers
 * Body: { externalId?: string, email?: string, firstName?: string, lastName?: string }
 */
router.post('/customers', async (req, res) => {
  const t = req.tenant!;
  const { externalId, email, firstName, lastName } = req.body;
  try {
    const customer = await prisma.customer.create({
      data: {
        tenantId: t.id,
        externalId,
        email,
        firstName,
        lastName
      }
    });
    return res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'could not create customer', details: err });
  }
});

/**
 * POST /api/data/products
 * Body: { externalId?: string, title: string, sku?: string, price: number }
 */
router.post('/products', async (req, res) => {
  const t = req.tenant!;
  const { externalId, title, sku, price } = req.body;
  if (!title || price === undefined) return res.status(400).json({ error: 'title and price required' });
  try {
    const product = await prisma.product.create({
      data: {
        tenantId: t.id,
        externalId,
        title,
        sku,
        price: Number(price)
      }
    });
    return res.status(201).json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'could not create product', details: err });
  }
});

/**
 * POST /api/data/orders
 * Body: { externalId?: string, customerExternalId?: string, totalPrice: number }
 * If customerExternalId provided, we try to find the tenant's customer and link.
 */
router.post('/orders', async (req, res) => {
  const t = req.tenant!;
  const { externalId, customerExternalId, totalPrice } = req.body;
  if (totalPrice === undefined) return res.status(400).json({ error: 'totalPrice required' });

  try {
    let customerId: number | undefined = undefined;
    if (customerExternalId) {
      const customer = await prisma.customer.findFirst({
        where: { tenantId: t.id, externalId: customerExternalId }
      });
      if (customer) customerId = customer.id;
    }

    const order = await prisma.order.create({
      data: {
        tenantId: t.id,
        externalId,
        customerId,
        totalPrice: Number(totalPrice)
      }
    });

    // update customer's totalSpent if linked
    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { totalSpent: { increment: Number(totalPrice) } }
      });
    }

    return res.status(201).json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'could not create order', details: err });
  }
});

export default router;
