"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface OrdersChartProps {
  data: Array<{
    date: string;
    orderCount: number;
    revenue: number;
    avgOrderValue?: number;
  }>;
}

export default function OrdersChart({ data }: OrdersChartProps) {
  const [metric, setMetric] = useState<"revenue" | "orderCount" | "avgOrderValue">("revenue");

  const metricConfig = {
    revenue: {
      label: "Revenue ($)",
      color: "#2563EB",
      fill: "url(#colorRevenue)",
      format: (val: number) => `$${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    },
    orderCount: {
      label: "Orders (#)",
      color: "#10B981",
      fill: "url(#colorOrders)",
      format: (val: number) => `${val.toLocaleString()} orders`,
    },
    avgOrderValue: {
      label: "Avg Order Value ($)",
      color: "#8B5CF6",
      fill: "url(#colorAov)",
      format: (val: number) => `$${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    },
  };

  const currentConfig = metricConfig[metric];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          Showing: <span className="font-semibold text-gray-900 dark:text-white">{currentConfig.label}</span>
        </div>
        <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setMetric("revenue")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              metric === "revenue"
                ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            Revenue
          </button>
          <button
            type="button"
            onClick={() => setMetric("orderCount")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              metric === "orderCount"
                ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            Orders
          </button>
          <button
            type="button"
            onClick={() => setMetric("avgOrderValue")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              metric === "avgOrderValue"
                ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            AOV
          </button>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorAov" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6B7280" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => (metric === "orderCount" ? val : `$${val}`)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                borderColor: "#374151",
                borderRadius: "0.5rem",
                color: "#F9FAFB",
                fontSize: "12px",
              }}
              formatter={(val: any) => [currentConfig.format(Number(val)), currentConfig.label]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={currentConfig.color}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={currentConfig.fill}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
