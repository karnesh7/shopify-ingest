"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import OrdersChart from "../../components/OrdersChart";

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  // fetch orders
  const [orders, setOrders] = useState<any>([]);
  const [topCustomers, setTopCustomers] = useState([]);

  //const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.externalId || '—';
  //const spend = Number(c.totalSpent ?? 0);
  const API = process.env.NEXT_PUBLIC_API_BASE;

  const apiKey = process.env.NEXT_PUBLIC_TENANT_API_KEY || "d164897e4fca3a9d1cdb6a878ce8752bfd0c036f237f7e4e";


  useEffect(() => {
    axios
      .get(`${API}/api/insights/summary`, {
        headers: { "x-api-key": apiKey },
      })
      .then(res => { console.log('summary res', res.data); setSummary(res.data); })
      .catch(err => { console.error('summary error', err); });
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/api/insights/orders`, {
        headers: { "x-api-key": apiKey },
      })
      .then((res) => setOrders(res.data.data));
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/api/insights/top-customers?limit=5`, {
        headers: { "x-api-key": apiKey },
      })
      .then((res) => setTopCustomers(res.data.data));
  }, []);


  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Summary</h2>

      {!summary && <p>Loading...</p>}

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded bg-gray-100">
            <h3>Total Customers</h3>
            <p className="text-2xl">{summary.totalCustomers}</p>
          </div>
          <div className="p-4 rounded bg-gray-100">
            <h3>Total Orders</h3>
            <p className="text-2xl">{summary.totalOrders}</p>
          </div>
          <div className="p-4 rounded bg-gray-100">
            <h3>Total Revenue</h3>
            <p className="text-2xl">${summary.totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mt-10 mb-4">Revenue Over Time</h2>
      {orders.length ? <OrdersChart data={orders} /> : <div className="h-64 bg-gray-50 flex items-center justify-center">No data</div>}

      <h2 className="text-xl font-semibold mt-10 mb-4">Top 5 Customers</h2>
      <table className="w-full border">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Spend</th>
          </tr>
        </thead>
        <tbody>
          {topCustomers.map((c: any, i: number) => (
            <tr key={i} className="border-b">
              <td className="p-2">{c.name}</td>
              <td className="p-2">{c.email}</td>
              <td className="p-2">${c.totalSpend.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}