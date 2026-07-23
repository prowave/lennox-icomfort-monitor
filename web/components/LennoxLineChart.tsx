"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PowerCycleEvent } from "@/lib/types";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** Render this line as a value-based gradient (green at 0 -> blue at 50 -> red at 100) instead of a solid stroke. Assumes a 0-100 domain. */
  gradient?: boolean;
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
  powerCycles,
}: {
  data: ChartPoint[];
  series: ChartSeries[];
  yUnit?: string;
  height?: number;
  domain?: [string | number, string | number];
  /** The actual query window (e.g. "last 24 hours"), so the axis always spans the
   * full selected period - not just from whenever the earliest/latest reading happened. */
  xDomain?: [number, number];
  /** Reconnect events - drawn as a vertical dotted marker rather than plotted as data,
   * since the device briefly reports sentinel values (not real readings) right after one. */
  powerCycles?: PowerCycleEvent[];
}) {
  return (
    <div className="card p-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            {series
              .filter((s) => s.gradient)
              .map((s) => (
                // Vertical gradient over the plot box: top (y1, high value) -> red,
                // middle -> blue, bottom (y2, low value) -> green.
                <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--status-critical)" />
                  <stop offset="50%" stopColor="var(--ice)" />
                  <stop offset="100%" stopColor="var(--status-good)" />
                </linearGradient>
              ))}
          </defs>
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
          {powerCycles?.map((event) => (
            <ReferenceLine
              key={event.ts}
              x={event.ts}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{ value: "Power cycle", position: "insideTopRight", fill: "var(--text-muted)", fontSize: 11 }}
            />
          ))}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.gradient ? `url(#gradient-${s.key})` : s.color}
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
