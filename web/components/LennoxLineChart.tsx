"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartPoint {
  ts: number;
  [seriesKey: string]: number | null;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LennoxLineChart({
  data,
  series,
  yUnit,
  height = 280,
  domain = ["auto", "auto"],
  xDomain,
}: {
  data: ChartPoint[];
  series: ChartSeries[];
  yUnit?: string;
  height?: number;
  domain?: [string | number, string | number];
  /** The actual query window (e.g. "last 24 hours"), so the axis always spans the
   * full selected period - not just from whenever the earliest/latest reading happened. */
  xDomain?: [number, number];
}) {
  return (
    <div className="card p-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            unit={yUnit}
            width={48}
            domain={domain}
            allowDecimals={false}
          />
          <Tooltip
            labelFormatter={(ts) => formatTime(Number(ts))}
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
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
