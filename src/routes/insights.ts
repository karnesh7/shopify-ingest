// src/routes/insights.ts
import { Router } from 'express';
import { requireTenant } from '../middleware/tenant';
import { PrismaClient, Prisma } from '@prisma/client';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { getQueueTelemetry } from '../queue/ingestQueue';

const prisma = new PrismaClient();
const router = Router();

// require x-api-key header for all insights endpoints
router.use(requireTenant);

/**
 * GET /api/insights/queue-status
 * Returns real-time async ingestion queue telemetry & worker health
 */
router.get('/queue-status', (req, res) => {
  const telemetry = getQueueTelemetry();
  return res.json({ telemetry });
});


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

/**
 * GET /api/insights/rfm
 * Computes Recency, Frequency, Monetary (RFM) segmentation for the tenant's customers
 */
router.get('/rfm', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;

    // Fetch all customers with their order history
    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: {
        orders: {
          select: { totalPrice: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });


    const now = Date.now();

    const scoredCustomers = customers.map((c) => {
      const orderCount = c.orders.length;
      const totalSpent = c.orders.reduce((acc, o) => acc + o.totalPrice, 0);
      const lastOrder = c.orders[0];
      const lastOrderDate = lastOrder ? lastOrder.createdAt : null;
      const recencyDays = lastOrderDate
        ? Math.max(0, Math.floor((now - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 999;

      // Recency Score (1-5)
      let rScore = 1;
      if (recencyDays <= 30) rScore = 5;
      else if (recencyDays <= 60) rScore = 4;
      else if (recencyDays <= 90) rScore = 3;
      else if (recencyDays <= 180) rScore = 2;

      // Frequency Score (1-5)
      let fScore = 1;
      if (orderCount >= 6) fScore = 5;
      else if (orderCount >= 4) fScore = 4;
      else if (orderCount >= 2) fScore = 3;
      else if (orderCount === 1) fScore = 2;

      // Monetary Score (1-5)
      let mScore = 1;
      if (totalSpent >= 500) mScore = 5;
      else if (totalSpent >= 250) mScore = 4;
      else if (totalSpent >= 100) mScore = 3;
      else if (totalSpent > 0) mScore = 2;

      // Determine RFM Segment & Marketing Recommendation
      let segment = 'Prospects';
      let action = 'Send Welcome Discount';
      let badgeColor = 'slate';

      if (orderCount === 0) {
        segment = 'Prospects';
        action = 'Welcome Series & First-Order Incentive';
        badgeColor = 'slate';
      } else if (rScore >= 4 && fScore >= 4 && mScore >= 4) {
        segment = 'Champions';
        action = 'VIP Early Access & Loyalty Perks';
        badgeColor = 'emerald';
      } else if (fScore >= 3 && mScore >= 3) {
        segment = 'Loyal Customers';
        action = 'Upsell Premium Catalog & Tier Rewards';
        badgeColor = 'blue';
      } else if (rScore >= 4 && fScore <= 2) {
        segment = 'Potential Loyalists';
        action = 'Cross-sell Complementary Accessories';
        badgeColor = 'purple';
      } else if (rScore <= 2 && (fScore >= 3 || mScore >= 3)) {
        segment = 'At Risk';
        action = 'Win-back Campaign & Exclusive 20% Off';
        badgeColor = 'amber';
      } else if (rScore <= 2 && fScore <= 2) {
        segment = 'Hibernating';
        action = 'Reactivation Email or Survey';
        badgeColor = 'red';
      } else {
        segment = 'Need Attention';
        action = 'Limited-Time Seasonal Promotion';
        badgeColor = 'indigo';
      }

      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.externalId || `Customer #${c.id}`;

      return {
        id: c.id,
        name,
        email: c.email || '—',
        orderCount,
        totalSpent: Number(totalSpent.toFixed(2)),
        recencyDays: orderCount > 0 ? recencyDays : null,
        lastOrderDate,
        rScore,
        fScore,
        mScore,
        segment,
        action,
        badgeColor,
      };
    });

    // Compute Segment Aggregate Distribution
    const segmentMap = new Map<string, { count: number; totalRevenue: number; avgRecencyDays: number; color: string }>();
    
    const PRESET_SEGMENTS = [
      { name: 'Champions', color: '#10B981' },
      { name: 'Loyal Customers', color: '#3B82F6' },
      { name: 'Potential Loyalists', color: '#8B5CF6' },
      { name: 'At Risk', color: '#F59E0B' },
      { name: 'Need Attention', color: '#6366F1' },
      { name: 'Hibernating', color: '#EF4444' },
      { name: 'Prospects', color: '#94A3B8' },
    ];

    PRESET_SEGMENTS.forEach((s) => {
      segmentMap.set(s.name, { count: 0, totalRevenue: 0, avgRecencyDays: 0, color: s.color });
    });

    scoredCustomers.forEach((c) => {
      const seg = segmentMap.get(c.segment);
      if (seg) {
        seg.count += 1;
        seg.totalRevenue += c.totalSpent;
      }
    });

    const totalCustomersCount = scoredCustomers.length;
    const segmentBreakdown = Array.from(segmentMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      percentage: totalCustomersCount > 0 ? Number(((data.count / totalCustomersCount) * 100).toFixed(1)) : 0,
      totalRevenue: Number(data.totalRevenue.toFixed(2)),
      color: data.color,
    }));

    return res.json({
      totalCustomers: totalCustomersCount,
      segments: segmentBreakdown,
      customers: scoredCustomers.sort((a, b) => b.totalSpent - a.totalSpent),
    });
  } catch (err) {
    console.error('insights/rfm error', err);
    return res.status(500).json({ error: 'could not compute RFM analytics' });
  }
});

/**
 * GET /api/insights/cohorts
 * Computes monthly cohort retention matrix for the active tenant
 */
router.get('/cohorts', async (req, res) => {
  try {
    const tenant = req.tenant!;
    const tenantId = tenant.id;

    // Fetch all orders for this tenant sorted by date
    const orders = await prisma.order.findMany({
      where: { tenantId, customerId: { not: null } },
      select: { customerId: true, createdAt: true, totalPrice: true },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) {
      return res.json({ cohorts: [], monthsHeader: [] });
    }

    // Step 1: Determine cohort (first order month) for each customer
    const customerFirstOrderMonth = new Map<number, string>();
    orders.forEach((o) => {
      if (o.customerId && !customerFirstOrderMonth.has(o.customerId)) {
        const d = new Date(o.createdAt);
        const cohortMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        customerFirstOrderMonth.set(o.customerId, cohortMonth);
      }
    });

    // Step 2: Track activity by (cohortMonth -> offsetMonth -> Set<customerId>)
    const cohortCustomers = new Map<string, Set<number>>();
    const cohortActivity = new Map<string, Map<number, Set<number>>>();

    orders.forEach((o) => {
      if (!o.customerId) return;
      const cohort = customerFirstOrderMonth.get(o.customerId)!;
      if (!cohort) return;

      if (!cohortCustomers.has(cohort)) {
        cohortCustomers.set(cohort, new Set<number>());
      }
      cohortCustomers.get(cohort)!.add(o.customerId);

      const [cYear, cMonth] = cohort.split('-').map(Number);
      const orderDate = new Date(o.createdAt);
      const oYear = orderDate.getUTCFullYear();
      const oMonth = orderDate.getUTCMonth() + 1;
      const monthOffset = (oYear - cYear) * 12 + (oMonth - cMonth);

      if (monthOffset >= 0 && monthOffset <= 6) {
        if (!cohortActivity.has(cohort)) {
          cohortActivity.set(cohort, new Map<number, Set<number>>());
        }
        const offsetMap = cohortActivity.get(cohort)!;
        if (!offsetMap.has(monthOffset)) {
          offsetMap.set(monthOffset, new Set<number>());
        }
        offsetMap.get(monthOffset)!.add(o.customerId);
      }
    });

    // Step 3: Format matrix
    const sortedCohorts = Array.from(cohortCustomers.keys()).sort();
    const maxPeriods = 6;
    const monthsHeader = Array.from({ length: maxPeriods + 1 }, (_, i) => `Month ${i}`);

    const cohortData = sortedCohorts.map((cohort) => {
      const cohortSize = cohortCustomers.get(cohort)?.size || 0;
      const activityMap = cohortActivity.get(cohort) || new Map<number, Set<number>>();

      const retentionRates: Array<number | null> = [];

      for (let offset = 0; offset <= maxPeriods; offset++) {
        if (activityMap.has(offset)) {
          const activeCount = activityMap.get(offset)!.size;
          const rate = cohortSize > 0 ? Number(((activeCount / cohortSize) * 100).toFixed(1)) : 0;
          retentionRates.push(rate);
        } else {
          retentionRates.push(offset === 0 ? 100 : 0);
        }
      }

      return {
        cohort,
        cohortSize,
        retentionRates,
      };
    });

    return res.json({
      cohorts: cohortData,
      monthsHeader,
    });
  } catch (err) {
    console.error('insights/cohorts error', err);
    return res.status(500).json({ error: 'could not compute cohort retention' });
  }
});

export default router;
