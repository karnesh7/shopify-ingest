"use client";

import React from "react";

interface CohortItem {
  cohort: string;
  cohortSize: number;
  retentionRates: Array<number | null>;
}

interface CohortHeatmapProps {
  data: {
    cohorts: CohortItem[];
    monthsHeader: string[];
  };
}

export default function CohortHeatmap({ data }: CohortHeatmapProps) {
  if (!data.cohorts || data.cohorts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        No cohort order data available to compute retention matrix.
      </div>
    );
  }

  // Calculate dynamic color intensity for retention rate percentage (0 - 100)
  const getCellBg = (rate: number | null, offset: number) => {
    if (rate === null || rate === undefined) return "bg-transparent text-gray-400";
    if (offset === 0) return "bg-blue-600 text-white font-bold";

    if (rate >= 60) return "bg-emerald-600 text-white font-semibold";
    if (rate >= 40) return "bg-emerald-500/80 text-white font-medium";
    if (rate >= 25) return "bg-emerald-400/60 text-gray-900 dark:text-white font-medium";
    if (rate >= 15) return "bg-emerald-300/40 text-gray-800 dark:text-zinc-200";
    if (rate > 0) return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300";

    return "bg-gray-50 text-gray-400 dark:bg-zinc-800/40 dark:text-zinc-500";
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Monthly Cohort Retention Heatmap
        </h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Percentage of acquired customers who returned to place repeat orders in subsequent months
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="pb-3 text-left font-semibold">Cohort Month</th>
              <th className="pb-3 font-semibold">Acquired</th>
              {data.monthsHeader.map((h, i) => (
                <th key={i} className="pb-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
            {data.cohorts.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                <td className="py-3 text-left font-mono font-medium text-gray-900 dark:text-white">
                  {row.cohort}
                </td>
                <td className="py-3 font-semibold text-gray-700 dark:text-zinc-300">
                  {row.cohortSize} users
                </td>
                {row.retentionRates.map((rate, offset) => (
                  <td key={offset} className="p-1">
                    <div
                      className={`flex h-8 items-center justify-center rounded-md text-xs transition-colors ${getCellBg(
                        rate,
                        offset
                      )}`}
                    >
                      {rate !== null && rate !== undefined ? `${rate}%` : "—"}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Heatmap Legend */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>Retention Intensity:</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-blue-600"></span> 100% Acquired
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-600"></span> &gt;60%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-400/60"></span> 25-60%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-950/40"></span> &lt;15%
          </span>
        </div>
      </div>
    </div>
  );
}
