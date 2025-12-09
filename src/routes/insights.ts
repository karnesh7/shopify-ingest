// src/routes/insights.ts
import { Router } from 'express';
import { requireTenant } from '../middleware/tenant';
import { PrismaClient, Prisma } from '@prisma/client';
import { parseISO, startOfDay, endOfDay } from 'date-fns';


const prisma = new PrismaClient();
const router = Router();

// require x-api-key header for all insights endpoints
router.use(requireTenant);

/**
 * GET /api/insights/summary
 * Returns: { totalCustomers, totalOrders, totalRevenue }
 */
router.get('/summary', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;

    // total customers
    const totalCustomers = await prisma.customer.count({ where: { tenantId } });

    // total orders and revenue
    const ordersAgg = await prisma.order.aggregate({
      where: { tenantId },
      _count: { id: true },
      _sum: { totalPrice: true },
    });

    const totalOrders = ordersAgg._count.id ?? 0;
    const totalRevenue = Number(ordersAgg._sum.totalPrice ?? 0);

    return res.json({ totalCustomers, totalOrders, totalRevenue });
  } catch (err) {
    console.error('insights/summary error', err);
    return res.status(500).json({ error: 'could not fetch summary' });
  }
});

/**
 * GET /api/insights/orders?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns orders grouped by date:
 * [{ date: '2025-12-06', orderCount: 3, revenue: 199.9 }, ...]
 */
router.get('/orders', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;

    const rawStart = req.query.start as string | undefined;
    const rawEnd = req.query.end as string | undefined;

    // default last 30 days if not provided
    const startDate = rawStart ? startOfDay(parseISO(rawStart)) : startOfDay(new Date(Date.now() - 1000 * 60 * 60 * 24 * 29));
    const endDate = rawEnd ? endOfDay(parseISO(rawEnd)) : endOfDay(new Date());

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    // Use Prisma.sql tagged template correctly
    const results = await prisma.$queryRaw<
      Array<{ date: string; orderCount: number; revenue: number }>
    >(
      Prisma.sql`
        SELECT DATE(createdAt) as date,
               COUNT(*) as orderCount,
               COALESCE(SUM(totalPrice),0) as revenue
        FROM \`Order\`
        WHERE tenantId = ${tenantId} AND createdAt BETWEEN ${startIso} AND ${endIso}
        GROUP BY DATE(createdAt)
        ORDER BY DATE(createdAt) ASC
      `
    );

    const normalized = results.map((r) => {
    const dateVal: any = r.date;
    let dateStr: string;

    if (dateVal && typeof dateVal.toISOString === 'function') {
        // it's a Date-like object
        dateStr = dateVal.toISOString().slice(0, 10);
    } else {
        dateStr = String(dateVal).slice(0, 10);
    }

    return {
        date: dateStr,
        orderCount: Number(r.orderCount),
        revenue: Number(r.revenue),
    };
    });

    return res.json({ start: startIso, end: endIso, data: normalized });
  } catch (err) {
    // Log detailed error for debugging
    console.error('insights/orders error', err);
    // If it's a Prisma error, log the meta if present
    if ((err as any)?.meta) {
      console.error('prisma meta:', (err as any).meta);
    }
    return res.status(500).json({ error: 'could not fetch orders by date' });
  }
});

/**
 * GET /api/insights/top-customers?limit=5
 * Returns top customers by totalSpent
 * [{ externalId, email, firstName, lastName, totalSpent }, ...]
 */
router.get('/top-customers', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const limit = Math.min(100, Number(req.query.limit || 5));

    const rows = await prisma.customer.findMany({
      where: { tenantId },
      orderBy: { totalSpent: 'desc' },
      take: limit,
      select: {
        externalId: true,
        email: true,
        firstName: true,
        lastName: true,
        totalSpent: true,
      },
    });

    return res.json({ data: rows });
  } catch (err) {
    console.error('insights/top-customers error', err);
    return res.status(500).json({ error: 'could not fetch top customers' });
  }
});

/**
 * GET /api/insights/recent-orders?limit=50
 * Returns recent orders for tenant (most recent first)
 */
router.get('/recent-orders', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const limit = Math.min(1000, Number(req.query.limit || 50));

    const rows = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { externalId: true, totalPrice: true, createdAt: true, customerId: true },
    });

    // Optionally join customer email/name for each order
    const ordersWithCustomer = await Promise.all(
      rows.map(async (o) => {
        const customer = o.customerId ? await prisma.customer.findUnique({ where: { id: o.customerId } }) : null;
        return {
          externalId: o.externalId,
          totalPrice: o.totalPrice,
          createdAt: o.createdAt,
          customer: customer ? { email: customer.email, firstName: customer.firstName, lastName: customer.lastName, externalId: customer.externalId } : null,
        };
      })
    );

    return res.json({ data: ordersWithCustomer });
  } catch (err) {
    console.error('insights/recent-orders error', err);
    return res.status(500).json({ error: 'could not fetch recent orders' });
  }
});

export default router;