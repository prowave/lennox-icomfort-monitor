"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint, ChartSeries } from "./LennoxLineChart";
import { findDataGaps } from "@/lib/chartData";

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
  const gaps = findDataGaps(data, xDomain);
  const hatchId = `no-data-hatch-${useId().replace(/:/g, "")}`;
  return (
    <div className="card p-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            {/* Diagonal hatch for "no data" gaps - var(--text-muted) is a mid-tone
                gray/tan that reads clearly against both the light and dark surface
                background, unlike a flat dark fill which washed out in dark mode. */}
            <pattern id={hatchId} width={8} height={8} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width={8} height={8} fill="var(--text-muted)" fillOpacity={0.15} />
              <line x1={0} y1={0} x2={0} y2={8} stroke="var(--text-muted)" strokeWidth={2} strokeOpacity={0.6} />
            </pattern>
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
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          {gaps.map(([from, to]) => (
            // Area shares Line's fixed zIndex layer (100) with ReferenceArea by
            // default, so bump this above it to guarantee it paints on top.
            <ReferenceArea
              key={`gap-${from}`}
              x1={from}
              x2={to}
              fill={`url(#${hatchId})`}
              stroke="var(--text-muted)"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              ifOverflow="hidden"
              zIndex={150}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
