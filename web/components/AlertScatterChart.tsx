"use client";

import {
  CartesianGrid,
  Legend,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import type { AlertScatterPoint } from "@/lib/types";
import { buildCodeColors, buildEquipmentBands, jitterFor } from "@/lib/alertScatterLayout";

const JITTER_AMPLITUDE = 0.32;

interface PlotPoint {
  ts: number;
  y: number;
  code: number;
  codeLabel: string;
  equipmentLabel: string;
  priority: string | null;
  userMessage: string | null;
}

function formatTimeLabel(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: PlotPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="p-3 rounded text-sm"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <div style={{ color: "var(--text-secondary)" }}>{formatTimeLabel(p.ts)}</div>
      <div className="font-medium mt-1">{p.equipmentLabel}</div>
      <div>
        {p.code} - {p.codeLabel}
      </div>
      {p.userMessage && <div style={{ color: "var(--text-secondary)" }}>{p.userMessage}</div>}
      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        priority: {p.priority ?? "unknown"}
      </div>
    </div>
  );
}

export function AlertScatterChart({
  points,
  height = 320,
  domain,
}: {
  points: AlertScatterPoint[];
  height?: number;
  /** The actual query window (e.g. "last 24 hours"), so the axis always ends at "now" -
   * not at whenever the most recent alert happened to occur. */
  domain?: { from: number; to: number };
}) {
  const bands = buildEquipmentBands(points);
  const bandByType = new Map(bands.map((b) => [b.equipmentType, b]));
  const entries = buildCodeColors(points);

  const byCode = new Map<number, PlotPoint[]>();
  for (const p of points) {
    const band = bandByType.get(p.equipmentType);
    if (!band) continue;
    const jitter = jitterFor(`${p.ts}-${p.code}-${p.equipmentType}`, JITTER_AMPLITUDE);
    const key = entries.some((e) => e.code === p.code) ? p.code : -1;
    const list = byCode.get(key) ?? [];
    list.push({
      ts: p.ts,
      y: band.y + jitter,
      code: p.code,
      codeLabel: p.codeLabel,
      equipmentLabel: p.equipmentLabel,
      priority: p.priority,
      userMessage: p.userMessage,
    });
    byCode.set(key, list);
  }

  if (bands.length === 0) {
    return (
      <div className="card p-4 flex items-center justify-center" style={{ height, color: "var(--text-muted)" }}>
        No alerts in this window.
      </div>
    );
  }

  return (
    <div className="card p-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--gridline)" />
          <XAxis
            type="number"
            dataKey="ts"
            domain={domain ? [domain.from, domain.to] : ["dataMin", "dataMax"]}
            tickFormatter={formatTimeLabel}
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            minTickGap={60}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[-0.6, bands.length - 0.4]}
            ticks={bands.map((b) => b.y)}
            tickFormatter={(y: number) => bands.find((b) => b.y === y)?.label ?? ""}
            reversed
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            width={110}
          />
          <ZAxis range={[64, 64]} />
          <Tooltip content={<TooltipContent />} cursor={{ strokeDasharray: "3 3", stroke: "var(--axis)" }} />
          <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 13 }} />
          {entries.map((entry) => (
            <Scatter
              key={entry.code}
              name={entry.label}
              data={byCode.get(entry.code) ?? []}
              fill={entry.color}
              fillOpacity={0.6}
              stroke="var(--surface-1)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
