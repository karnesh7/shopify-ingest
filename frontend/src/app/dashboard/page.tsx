"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import OrdersChart from "../../components/OrdersChart";
import CustomerSegmentChart from "../../components/CustomerSegmentChart";
import KpiCard from "../../components/KpiCard";
import RfmSegmentation from "../../components/RfmSegmentation";
import CohortHeatmap from "../../components/CohortHeatmap";
import { subDays, format } from "date-fns";

export default function DashboardPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "rfm" | "cohorts">("overview");

  const [summary, setSummary] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [customerMetrics, setCustomerMetrics] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any>({ metrics: {}, data: [] });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [rfmData, setRfmData] = useState<any>(null);
  const [cohortData, setCohortData] = useState<any>(null);

  // Date range presets
  const [preset, setPreset] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const end = new Date();
    const start = subDays(end, 29);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    setStartDate(startStr);
    setEndDate(endStr);

    const storedKey = localStorage.getItem("apiKey") || "";
    setApiKey(storedKey);
  }, []);

  useEffect(() => {
    if (!mounted || !apiKey) return;
    fetchAllData();
  }, [mounted, apiKey]);

  function fetchAllData() {
    if (!apiKey) return;
    setLoading(true);

    const headers = { "x-api-key": apiKey };

    // Fetch Summary
    axios
      .get(`${API}/api/insights/summary`, { headers })
      .then((res) => setSummary(res.data))
      .catch((err) => console.error("summary error", err));

    // Fetch Time-series Orders
    fetchOrders(startDate, endDate);

    // Fetch Customer Metrics
    axios
      .get(`${API}/api/insights/customer-metrics`, { headers })
      .then((res) => setCustomerMetrics(res.data))
      .catch((err) => console.error("customer-metrics error", err));

    // Fetch Top Customers
    axios
      .get(`${API}/api/insights/top-customers?limit=5`, { headers })
      .then((res) => setTopCustomers(res.data.data || []))
      .catch((err) => console.error("top customers error", err));

    // Fetch Top Products
    axios
      .get(`${API}/api/insights/top-products?limit=5`, { headers })
      .then((res) => setTopProducts(res.data || { metrics: {}, data: [] }))
      .catch((err) => console.error("top products error", err));

    // Fetch Recent Orders
    axios
      .get(`${API}/api/insights/recent-orders?limit=10`, { headers })
      .then((res) => setRecentOrders(res.data.data || []))
      .catch((err) => console.error("recent orders error", err));

    // Fetch RFM Segmentation
    axios
      .get(`${API}/api/insights/rfm`, { headers })
      .then((res) => setRfmData(res.data))
      .catch((err) => console.error("rfm error", err));

    // Fetch Cohort Retention Matrix
    axios
      .get(`${API}/api/insights/cohorts`, { headers })
      .then((res) => setCohortData(res.data))
      .catch((err) => console.error("cohorts error", err))
      .finally(() => setLoading(false));
  }

  async function fetchOrders(start: string, end: string) {
    if (!apiKey) return;
    try {
      const res = await axios.get(`${API}/api/insights/orders`, {
        params: { start, end },
        headers: { "x-api-key": apiKey },
      });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error("orders fetch error", err);
    }
  }

  const handlePresetChange = (newPreset: "7d" | "30d" | "90d") => {
    setPreset(newPreset);
    const end = new Date();
    let days = 29;
    if (newPreset === "7d") days = 6;
    if (newPreset === "90d") days = 89;

    const start = subDays(end, days);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");

    setStartDate(startStr);
    setEndDate(endStr);
    fetchOrders(startStr, endStr);
  };

  const handleCustomDateApply = () => {
    setPreset("custom");
    fetchOrders(startDate, endDate);
  };

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        Loading insights dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & API Key Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Store Connection & Settings</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Provide your tenant API key to fetch live store telemetry
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-900 font-mono focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-80"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem("apiKey", e.target.value);
              }}
              placeholder="Paste x-api-key here (e.g. dev-key-123)"
            />
            <button
              onClick={fetchAllData}
              disabled={loading || !apiKey}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {!apiKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="text-sm font-medium">Please enter a valid Tenant API key above to load store telemetry.</p>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-1 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "overview"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          }`}
        >
          Executive Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rfm")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "rfm"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          }`}
        >
          RFM Customer Intelligence
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cohorts")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "cohorts"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          }`}
        >
          Cohort Retention Matrix
        </button>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Metrics Cards Grid */}
          {summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                title="Total Revenue"
                value={`$${Number(summary.totalRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                subtitle="Gross sales"
                badgeText="Revenue"
                badgeVariant="blue"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <KpiCard
                title="Total Orders"
                value={Number(summary.totalOrders ?? 0).toLocaleString()}
                subtitle="Completed purchases"
                badgeText="Volume"
                badgeVariant="green"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                }
              />
              <KpiCard
                title="Avg Order Value"
                value={`$${Number(summary.averageOrderValue ?? 0).toFixed(2)}`}
                subtitle="Per completed order"
                badgeText="AOV"
                badgeVariant="purple"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <KpiCard
                title="Total Customers"
                value={Number(summary.totalCustomers ?? 0).toLocaleString()}
                subtitle="Registered store accounts"
                badgeText="Audience"
                badgeVariant="amber"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5 5 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
              />
              <KpiCard
                title="Repeat Customer Rate"
                value={`${Number(summary.repeatCustomerRate ?? 0).toFixed(1)}%`}
                subtitle={`${summary.repeatCustomersCount ?? 0} repeat buyers`}
                badgeText="Retention"
                badgeVariant="blue"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              />
              <KpiCard
                title="Catalog Products"
                value={Number(summary.totalProducts ?? 0).toLocaleString()}
                subtitle="Active items in store"
                badgeText="Catalog"
                badgeVariant="neutral"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
              />
            </div>
          )}

          {/* Main Time Series Analytics Chart Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sales & Performance Trends</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Track revenue, order volume, and average order value over custom time windows
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-zinc-800">
                  <button
                    type="button"
                    onClick={() => handlePresetChange("7d")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      preset === "7d"
                        ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-zinc-400"
                    }`}
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetChange("30d")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      preset === "30d"
                        ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-zinc-400"
                    }`}
                  >
                    30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetChange("90d")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      preset === "90d"
                        ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-zinc-400"
                    }`}
                  >
                    90 Days
                  </button>
                </div>

                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <button
                    onClick={handleCustomDateApply}
                    className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {orders.length > 0 ? (
              <OrdersChart data={orders} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500 dark:bg-zinc-800/40 dark:text-zinc-400">
                No order data available for selected date range
              </div>
            )}
          </div>

          {/* 2-Column Grid: Customer Breakdown & Top Customers */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Customer Retention Breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Customer Retention Breakdown</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Distribution of customer accounts by order volume
                </p>
              </div>

              {customerMetrics ? (
                <div className="flex flex-col items-center sm:flex-row">
                  <div className="w-full sm:w-1/2">
                    <CustomerSegmentChart data={customerMetrics} />
                  </div>
                  <div className="mt-4 w-full space-y-3 sm:mt-0 sm:w-1/2 sm:pl-4">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5 text-xs dark:bg-zinc-800/60">
                      <span className="flex items-center text-gray-600 dark:text-zinc-400">
                        <span className="mr-2 h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                        Prospects (0 Orders)
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{customerMetrics.zeroOrderCustomers}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5 text-xs dark:bg-zinc-800/60">
                      <span className="flex items-center text-gray-600 dark:text-zinc-400">
                        <span className="mr-2 h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                        One-Time Buyers
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{customerMetrics.oneTimeBuyers}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5 text-xs dark:bg-zinc-800/60">
                      <span className="flex items-center text-gray-600 dark:text-zinc-400">
                        <span className="mr-2 h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        Repeat Buyers (2+ Orders)
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{customerMetrics.repeatBuyers}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-gray-500 dark:text-zinc-400">
                  Loading customer metrics...
                </div>
              )}
            </div>

            {/* Top Customers Table */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Top High-Value Customers</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Customers with the highest cumulative spending
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                  Top 5
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold">Email</th>
                      <th className="pb-3 font-semibold text-center">Orders</th>
                      <th className="pb-3 font-semibold text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                    {topCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500 dark:text-zinc-400">
                          No customer data available
                        </td>
                      </tr>
                    ) : (
                      topCustomers.map((c: any, i: number) => {
                        const name = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.externalId || `Customer #${c.id}`;
                        return (
                          <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                            <td className="py-3 font-medium text-gray-900 dark:text-white">{name}</td>
                            <td className="py-3 text-gray-500 dark:text-zinc-400">{c.email || "—"}</td>
                            <td className="py-3 text-center">
                              <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 font-mono text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {c.orderCount ?? 0}
                              </span>
                            </td>
                            <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              ${Number(c.totalSpent ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 2-Column Grid: Catalog Products & Recent Activity */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Product Catalog */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Product Catalog & Prices</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Store items sorted by unit price
                  </p>
                </div>
                {topProducts.metrics?.avgPrice !== undefined && (
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    Avg Price: <strong className="text-gray-900 dark:text-white">${topProducts.metrics.avgPrice.toFixed(2)}</strong>
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="pb-3 font-semibold">Product Title</th>
                      <th className="pb-3 font-semibold">SKU</th>
                      <th className="pb-3 font-semibold text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                    {topProducts.data?.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-gray-500 dark:text-zinc-400">
                          No products found in catalog
                        </td>
                      </tr>
                    ) : (
                      topProducts.data?.map((p: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                          <td className="py-3 font-medium text-gray-900 dark:text-white">{p.title}</td>
                          <td className="py-3 font-mono text-gray-500 dark:text-zinc-400">{p.sku || "—"}</td>
                          <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">
                            ${Number(p.price).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Ingested Orders */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent Store Orders</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Latest order telemetry synced from Shopify
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  Live Feed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="pb-3 font-semibold">Order ID</th>
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold text-right">Amount</th>
                      <th className="pb-3 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500 dark:text-zinc-400">
                          No recent orders recorded
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((o: any, i: number) => {
                        const custName = o.customer ? `${o.customer.firstName || ""} ${o.customer.lastName || ""}`.trim() : o.customer?.externalId || "Guest";
                        return (
                          <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                            <td className="py-3 font-mono font-medium text-gray-900 dark:text-white">
                              #{o.externalId || `ORD-${i + 1}`}
                            </td>
                            <td className="py-3 text-gray-600 dark:text-zinc-300">{custName}</td>
                            <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">
                              ${Number(o.totalPrice).toFixed(2)}
                            </td>
                            <td className="py-3 text-right text-gray-400 dark:text-zinc-500">
                              {format(new Date(o.createdAt), "yyyy-MM-dd")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RFM CUSTOMER INTELLIGENCE */}
      {activeTab === "rfm" && (
        <div>
          {rfmData ? (
            <RfmSegmentation data={rfmData} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              Loading RFM analytics...
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COHORT RETENTION MATRIX */}
      {activeTab === "cohorts" && (
        <div>
          {cohortData ? (
            <CohortHeatmap data={cohortData} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              Loading cohort retention matrix...
            </div>
          )}
        </div>
      )}
    </div>
  );
}