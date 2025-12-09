"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import OrdersChart from "../../components/OrdersChart";
import { formatISO, subDays } from "date-fns";

export default function DashboardPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
  const defaultApiKey = typeof window !== "undefined" ? (localStorage.getItem("apiKey") || "") : "";
  const [apiKey, setApiKey] = useState<string>(defaultApiKey);

  const [summary, setSummary] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);

  // date range state (default last 30 days)
  const defaultEnd = new Date();
  const defaultStart = subDays(defaultEnd, 29);

  const [startDate, setStartDate] = useState<string>(defaultStart.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(defaultEnd.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);

    axios
      .get(`${API}/api/insights/summary`, { headers: { "x-api-key": apiKey } })
      .then((res) => setSummary(res.data))
      .catch((err) => console.error("summary error", err))
      .finally(() => setLoading(false));

    // initial fetch orders/top-customers
    fetchOrders(startDate, endDate);
    fetchTopCustomers();
  }, [apiKey]);

  async function fetchOrders(start: string, end: string) {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/insights/orders`, {
        params: { start, end },
        headers: { "x-api-key": apiKey },
      });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error("orders fetch error", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTopCustomers() {
    if (!apiKey) return;
    try {
      const res = await axios.get(`${API}/api/insights/top-customers?limit=5`, {
        headers: { "x-api-key": apiKey },
      });
      setTopCustomers(res.data.data || []);
    } catch (err) {
      console.error("top customers fetch error", err);
    }
  }

  async function fetchRecentOrders() {
    if (!apiKey) return;
    try {
      const res = await axios.get(`${API}/api/insights/recent-orders?limit=50`, {
        headers: { "x-api-key": apiKey },
      });
      return res.data.data || [];
    } catch (err) {
      console.error("recent orders fetch error", err);
      return [];
    }
  }

  async function onRefresh() {
    await fetchOrders(startDate, endDate);
    const recent = await fetchRecentOrders();
    // optionally combine recent into a state for table
    setRecentOrders(recent);
  }

  // small state for recent orders table
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    // load recent orders on first render if apiKey present
    if (!apiKey) return;
    (async () => {
      const recent = await fetchRecentOrders();
      setRecentOrders(recent);
    })();
  }, [apiKey]);


  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm text-gray-200 mb-1">Tenant API Key (dev)</label>
        <input
          className="w-full p-2 rounded bg-gray-800 text-white"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            localStorage.setItem("apiKey", e.target.value);
          }}
          placeholder="Paste tenant API key"
        />
      </div>

      <h2 className="text-xl font-semibold mb-4">Summary</h2>
      {!summary && <p>Loading...</p>}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded bg-white text-gray-800 shadow">
            <h3 className="text-sm font-medium">Total Customers</h3>
            <p className="text-2xl font-bold">{summary.totalCustomers}</p>
          </div>

          <div className="p-4 rounded bg-white text-gray-800 shadow">
            <h3 className="text-sm font-medium">Total Orders</h3>
            <p className="text-2xl font-bold">{summary.totalOrders}</p>
          </div>

          <div className="p-4 rounded bg-white text-gray-800 shadow">
            <h3 className="text-sm font-medium">Total Revenue</h3>
            <p className="text-2xl font-bold">${Number(summary.totalRevenue ?? 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Revenue Over Time</h2>

        <div className="flex gap-2 items-center mb-4">
          <label className="text-sm">Start</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 rounded" />
          <label className="text-sm">End</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 rounded" />
          <button onClick={onRefresh} className="ml-2 px-3 py-1 bg-black text-white rounded">
            Refresh
          </button>
        </div>

        {orders.length > 0 ? (
          <div>
            <OrdersChart data={orders} />
          </div>
        ) : (
          <div className="h-64 bg-gray-50 flex items-center justify-center">No data</div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Top 5 Customers</h2>
        <table className="w-full border">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Spend</th>
            </tr>
          </thead>
          <tbody>
            {topCustomers.length === 0 ? (
              <tr>
                <td className="p-4" colSpan={3}>
                  No customers yet
                </td>
              </tr>
            ) : (
              topCustomers.map((c: any, i: number) => {
                const name = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.externalId || "—";
                const email = c.email || "—";
                const spend = Number(c.totalSpent ?? 0);
                return (
                  <tr key={i} className="border-b">
                    <td className="p-2">{name}</td>
                    <td className="p-2">{email}</td>
                    <td className="p-2">${spend.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        <table className="w-full border">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Order ID</th>
              <th className="p-2 text-left">Customer</th>
              <th className="p-2 text-left">Amount</th>
              <th className="p-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <td className="p-4" colSpan={4}>
                  No recent orders
                </td>
              </tr>
            ) : (
              recentOrders.map((o: any, i: number) => {
                const custName = o.customer ? `${o.customer.firstName || ""} ${o.customer.lastName || ""}`.trim() : o.customer?.externalId || "—";
                return (
                  <tr key={i} className="border-b">
                    <td className="p-2">{o.externalId}</td>
                    <td className="p-2">{custName}</td>
                    <td className="p-2">${Number(o.totalPrice).toFixed(2)}</td>
                    <td className="p-2">{new Date(o.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}