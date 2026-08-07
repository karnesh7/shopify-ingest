"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface CustomerSegmentChartProps {
  data: {
    zeroOrderCustomers: number;
    oneTimeBuyers: number;
    repeatBuyers: number;
  };
}

const COLORS = ["#94A3B8", "#3B82F6", "#10B981"];

export default function CustomerSegmentChart({ data }: CustomerSegmentChartProps) {
  const chartData = [
    { name: "Prospects (0 Orders)", value: data.zeroOrderCustomers },
    { name: "One-Time Buyers", value: data.oneTimeBuyers },
    { name: "Repeat Customers", value: data.repeatBuyers },
  ].filter((item) => item.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-gray-500 dark:text-zinc-400">
        No customer segment data available
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              borderColor: "#374151",
              borderRadius: "0.5rem",
              color: "#F9FAFB",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
