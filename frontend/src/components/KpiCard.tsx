"use client";

import React from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  badgeText?: string;
  badgeVariant?: "blue" | "green" | "purple" | "amber" | "neutral";
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  badgeVariant = "blue",
}: KpiCardProps) {
  const badgeStyles = {
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
    purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
    neutral: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-xs transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
          {title}
        </span>
        {icon && (
          <div className="rounded-lg p-2 bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300 group-hover:scale-105 transition-transform">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h4 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {value}
        </h4>
        {badgeText && (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyles[badgeVariant]}`}>
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
