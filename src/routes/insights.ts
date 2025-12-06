// src/routes/insights.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireTenant } from '../middleware/tenant';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { Prisma } from '@prisma/client';

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
    let startDate = rawStart ? startOfDay(parseISO(rawStart)) : startOfDay(new Date(Date.now() - 1000 * 60 * 60 * 24 * 29));
    let endDate = rawEnd ? endOfDay(parseISO(rawEnd)) : endOfDay(new Date());

    // Prisma groupBy per-day using DATE(createdAt) via raw query if necessary.
    // Safer approach: aggregate via SQL-like grouping using $queryRaw for portability.
    const results = await prisma.$queryRaw<
      Array<{ date: string; orderCount: number; revenue: number }>
    >(
    Prisma.sql`
        SELECT DATE(createdAt) as date,
            COUNT(*) as orderCount,
            COALESCE(SUM(totalPrice), 0) as revenue
        FROM \`Order\`
        WHERE tenantId = ${tenantId} AND createdAt BETWEEN ${startDate} AND ${endDate}
        GROUP BY DATE(createdAt)
        ORDER BY DATE(createdAt) ASC
    `
    );

    // normalize date strings (YYYY-MM-DD)
    const normalized = results.map((r) => ({
      date: (r.date as unknown as string).slice(0, 10),
      orderCount: Number(r.orderCount),
      revenue: Number(r.revenue),
    }));

    return res.json({ start: startDate.toISOString(), end: endDate.toISOString(), data: normalized });
  } catch (err) {
    console.error('insights/orders error', err);
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

export default router;