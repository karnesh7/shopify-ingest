"use client";

import { useEffect, useState } from "react";
import axios from "axios";

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const API = process.env.NEXT_PUBLIC_API_BASE;

  const apiKey = "REPLACE_WITH_TENANT_API_KEY"; // you’ll replace with the tenant key later

  useEffect(() => {
    axios
      .get(`${API}/api/insights/summary`, {
        headers: { "x-api-key": apiKey },
      })
      .then((res) => setSummary(res.data));
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
    </div>
  );
}