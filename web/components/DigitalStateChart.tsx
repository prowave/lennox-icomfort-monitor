"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint, ChartSeries } from "./LennoxLineChart";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DigitalStateChart({
  data,
  series,
  onLabel,
  offLabel,
  height = 160,
  xDomain,
}: {
  data: ChartPoint[];
  series: ChartSeries[];
  onLabel: string;
  offLabel: string;
  height?: number;
  xDomain?: [number, number];
}) {
  return (
    <div className="card p-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            type="number"
            dataKey="ts"
            domain={xDomain ?? ["auto", "auto"]}
            tickFormatter={formatTime}
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            minTickGap={40}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            ticks={[0, 1]}
            tickFormatter={(v: number) => (v === 1 ? onLabel : offLabel)}
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            width={70}
          />
          <Tooltip
            labelFormatter={(ts) => formatTime(Number(ts))}
            formatter={(value, name) => [value === 1 ? onLabel : offLabel, name]}
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
            }}
            labelStyle={{ color: "var(--text-secondary)" }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 13 }} />}
          {series.map((s) => (
            <Area
              key={s.key}
              type="step"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={s.color}
              fillOpacity={0.35}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
