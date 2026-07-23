"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyCostEntry } from "@/lib/types";

function formatDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DailyCostEntry }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="p-3 rounded text-sm"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <div style={{ color: "var(--text-secondary)" }}>{p.date}</div>
      <div className="font-medium">${p.estimatedCost.toFixed(2)}</div>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {Math.round(p.coolingMinutes)} min cooling, {Math.round(p.avgDemandPct)}% avg effort
      </div>
    </div>
  );
}

export function DailyCostBarChart({ days, height = 260 }: { days: DailyCostEntry[]; height?: number }) {
  return (
    <div className="card p-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          />
          <YAxis
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(v: number) => `$${v}`}
            width={48}
          />
          <Tooltip content={<TooltipContent />} cursor={{ fill: "var(--gridline)" }} />
          <Bar dataKey="estimatedCost" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
