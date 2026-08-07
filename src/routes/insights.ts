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
 * Returns: { totalCustomers, totalOrders, totalRevenue, totalProducts, averageOrderValue, avgSpendPerCustomer, repeatCustomerRate, repeatCustomersCount }
 */
router.get('/summary', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;

    // total customers
    const totalCustomers = await prisma.customer.count({ where: { tenantId } });

    // total products
    const totalProducts = await prisma.product.count({ where: { tenantId } });

    // total orders and revenue
    const ordersAgg = await prisma.order.aggregate({
      where: { tenantId },
      _count: { id: true },
      _sum: { totalPrice: true },
    });

    const totalOrders = ordersAgg._count.id ?? 0;
    const totalRevenue = Number(ordersAgg._sum.totalPrice ?? 0);
    const averageOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;
    const avgSpendPerCustomer = totalCustomers > 0 ? Number((totalRevenue / totalCustomers).toFixed(2)) : 0;

    // Calculate repeat customer rate
    const customerOrderCounts = await prisma.$queryRaw<Array<{ customerId: number; count: number }>>(
      Prisma.sql`
        SELECT customerId, COUNT(*) as count
        FROM \`Order\`
        WHERE tenantId = ${tenantId} AND customerId IS NOT NULL
        GROUP BY customerId
      `
    );

    const repeatCustomersCount = customerOrderCounts.filter((c) => Number(c.count) > 1).length;
    const totalOrderingCustomers = customerOrderCounts.length;
    const repeatCustomerRate = totalOrderingCustomers > 0
      ? Number(((repeatCustomersCount / totalOrderingCustomers) * 100).toFixed(1))
      : 0;

    return res.json({
      totalCustomers,
      totalOrders,
      totalRevenue,
      totalProducts,
      averageOrderValue,
      avgSpendPerCustomer,
      repeatCustomerRate,
      repeatCustomersCount,
      totalOrderingCustomers
    });
  } catch (err) {
    console.error('insights/summary error', err);
    return res.status(500).json({ error: 'could not fetch summary' });
  }
});

/**
 * GET /api/insights/orders?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns orders grouped by date:
 * [{ date: '2025-12-06', orderCount: 3, revenue: 199.9, avgOrderValue: 66.63 }, ...]
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
        dateStr = dateVal.toISOString().slice(0, 10);
      } else {
        dateStr = String(dateVal).slice(0, 10);
      }

      const orderCount = Number(r.orderCount);
      const revenue = Number(r.revenue);
      const avgOrderValue = orderCount > 0 ? Number((revenue / orderCount).toFixed(2)) : 0;

      return {
        date: dateStr,
        orderCount,
        revenue,
        avgOrderValue,
      };
    });

    return res.json({ start: startIso, end: endIso, data: normalized });
  } catch (err) {
    console.error('insights/orders error', err);
    if ((err as any)?.meta) {
      console.error('prisma meta:', (err as any).meta);
    }
    return res.status(500).json({ error: 'could not fetch orders by date' });
  }
});

/**
 * GET /api/insights/top-customers?limit=5
 * Returns top customers by totalSpent including orderCount
 * [{ id, externalId, email, firstName, lastName, orderCount, totalSpent }, ...]
 */
router.get('/top-customers', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const limit = Math.min(100, Number(req.query.limit || 5));

    const rows = await prisma.$queryRaw<
      Array<{
        id: number;
        externalId: string | null;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        orderCount: number;
        totalSpent: number;
      }>
    >(
      Prisma.sql`
      SELECT c.id,
             c.externalId,
             c.email,
             c.firstName,
             c.lastName,
             COUNT(o.id) as orderCount,
             COALESCE(SUM(o.totalPrice), 0) as totalSpent
      FROM \`Customer\` c
      LEFT JOIN \`Order\` o
        ON o.customerId = c.id AND o.tenantId = ${tenantId}
      WHERE c.tenantId = ${tenantId}
      GROUP BY c.id
      ORDER BY totalSpent DESC
      LIMIT ${limit};
    `
    );

    const formattedRows = rows.map((r) => ({
      ...r,
      orderCount: Number(r.orderCount),
      totalSpent: Number(r.totalSpent),
    }));

    return res.json({ data: formattedRows });
  } catch (err) {
    console.error('insights/top-customers error', err);
    return res.status(500).json({ error: 'could not fetch top customers' });
  }
});

/**
 * GET /api/insights/customer-metrics
 * Returns customer order distribution segments (zero, one-time, repeat buyers)
 */
router.get('/customer-metrics', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;

    const customersWithOrders = await prisma.$queryRaw<Array<{ customerId: number; orderCount: number }>>(
      Prisma.sql`
        SELECT customerId, COUNT(*) as orderCount
        FROM \`Order\`
        WHERE tenantId = ${tenantId} AND customerId IS NOT NULL
        GROUP BY customerId
      `
    );

    const totalCustomers = await prisma.customer.count({ where: { tenantId } });

    let oneTimeBuyers = 0;
    let repeatBuyers = 0;

    customersWithOrders.forEach((c) => {
      const cnt = Number(c.orderCount);
      if (cnt === 1) oneTimeBuyers++;
      else if (cnt > 1) repeatBuyers++;
    });

    const customersWithAnyOrder = customersWithOrders.length;
    const zeroOrderCustomers = Math.max(0, totalCustomers - customersWithAnyOrder);

    return res.json({
      totalCustomers,
      zeroOrderCustomers,
      oneTimeBuyers,
      repeatBuyers,
    });
  } catch (err) {
    console.error('insights/customer-metrics error', err);
    return res.status(500).json({ error: 'could not fetch customer metrics' });
  }
});

/**
 * GET /api/insights/top-products?limit=10
 * Returns product catalog insights & products sorted by price/created
 */
router.get('/top-products', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const limit = Math.min(100, Number(req.query.limit || 10));

    const products = await prisma.product.findMany({
      where: { tenantId },
      orderBy: { price: 'desc' },
      take: limit,
    });

    const priceAgg = await prisma.product.aggregate({
      where: { tenantId },
      _count: { id: true },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
    });

    return res.json({
      metrics: {
        totalProducts: priceAgg._count.id ?? 0,
        avgPrice: Number(priceAgg._avg.price ?? 0),
        minPrice: Number(priceAgg._min.price ?? 0),
        maxPrice: Number(priceAgg._max.price ?? 0),
      },
      data: products,
    });
  } catch (err) {
    console.error('insights/top-products error', err);
    return res.status(500).json({ error: 'could not fetch top products' });
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