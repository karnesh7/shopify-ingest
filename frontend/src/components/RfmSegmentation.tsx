"use client";

import React, { useState } from "react";

interface RfmCustomer {
  id: number;
  name: string;
  email: string;
  orderCount: number;
  totalSpent: number;
  recencyDays: number | null;
  rScore: number;
  fScore: number;
  mScore: number;
  segment: string;
  action: string;
  badgeColor: string;
}

interface RfmSegmentSummary {
  name: string;
  count: number;
  percentage: number;
  totalRevenue: number;
  color: string;
}

interface RfmProps {
  data: {
    totalCustomers: number;
    segments: RfmSegmentSummary[];
    customers: RfmCustomer[];
  };
}

export default function RfmSegmentation({ data }: RfmProps) {
  const [selectedSegment, setSelectedSegment] = useState<string>("All");

  const filteredCustomers =
    selectedSegment === "All"
      ? data.customers
      : data.customers.filter((c) => c.segment === selectedSegment);

  const getBadgeStyle = (segment: string) => {
    switch (segment) {
      case "Champions":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400";
      case "Loyal Customers":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400";
      case "Potential Loyalists":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400";
      case "At Risk":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400";
      case "Hibernating":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Segment Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {data.segments.map((seg, idx) => {
          const isSelected = selectedSegment === seg.name;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedSegment(isSelected ? "All" : seg.name)}
              className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all hover:shadow-xs ${
                isSelected
                  ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  {seg.name}
                </span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
              </div>
              <div className="mt-2">
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {seg.count}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                  {seg.percentage}% of audience • ${seg.totalRevenue.toFixed(0)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Header & Segment Description */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Customer RFM Intelligence & Recommended Actions
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Showing {filteredCustomers.length} of {data.totalCustomers} customers • Filter:{" "}
              <strong className="text-gray-900 dark:text-white">{selectedSegment}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedSegment("All")}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                selectedSegment === "All"
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              View All
            </button>
          </div>
        </div>

        {/* Customer RFM Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Segment</th>
                <th className="pb-3 font-semibold text-center">R-F-M Score</th>
                <th className="pb-3 font-semibold text-center">Recency</th>
                <th className="pb-3 font-semibold text-center">Orders</th>
                <th className="pb-3 font-semibold text-right">Total Spend</th>
                <th className="pb-3 font-semibold">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-zinc-400">
                    No customers found for segment "{selectedSegment}"
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-gray-400 dark:text-zinc-500">{c.email}</div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getBadgeStyle(
                          c.segment
                        )}`}
                      >
                        {c.segment}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {c.rScore}-{c.fScore}-{c.mScore}
                      </span>
                    </td>
                    <td className="py-3 text-center text-gray-600 dark:text-zinc-400">
                      {c.recencyDays !== null ? `${c.recencyDays}d ago` : "Never"}
                    </td>
                    <td className="py-3 text-center font-mono font-medium text-gray-800 dark:text-zinc-200">
                      {c.orderCount}
                    </td>
                    <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      ${c.totalSpent.toFixed(2)}
                    </td>
                    <td className="py-3">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {c.action}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
