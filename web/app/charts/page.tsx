"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { LennoxLineChart, type ChartPoint, type ChartSeries } from "@/components/LennoxLineChart";
import { AlertScatterChart } from "@/components/AlertScatterChart";
import { DailyCostBarChart } from "@/components/DailyCostBarChart";
import { colorForZone, OUTDOOR_COLOR } from "@/lib/palette";
import type { AlertScatterPoint, DailyCostEntry, HistoryPoint } from "@/lib/types";

const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const RANGE_PRESETS = [
  { label: "Last hour", ms: 60 * 60 * 1000 },
  { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
];

interface SeriesRequest {
  key: string;
  label: string;
  color: string;
  zoneId?: number;
  metric: string;
}

function buildSeriesRequests(zoneIds: number[]): { temperature: SeriesRequest[]; humidity: SeriesRequest[] } {
  const temperature: SeriesRequest[] = [
    { key: "outdoor", label: "Outdoor", color: OUTDOOR_COLOR, metric: "outdoor_temperature" },
    ...zoneIds.map((id) => ({
      key: `zone-${id}`,
      label: `Zone ${id}`,
      color: colorForZone(id),
      zoneId: id,
      metric: "temperature",
    })),
  ];
  const humidity: SeriesRequest[] = zoneIds.map((id) => ({
    key: `zone-${id}`,
    label: `Zone ${id}`,
    color: colorForZone(id),
    zoneId: id,
    metric: "humidity",
  }));
  return { temperature, humidity };
}

async function fetchSeries(requests: SeriesRequest[], from: number, to: number): Promise<ChartPoint[]> {
  const results = await Promise.all(
    requests.map(async (r) => {
      const params = new URLSearchParams({ metric: r.metric, from: String(from), to: String(to) });
      if (r.zoneId !== undefined) params.set("zoneId", String(r.zoneId));
      const res = await fetch(`/api/history?${params.toString()}`);
      const json: { points?: HistoryPoint[] } = await res.json();
      return { key: r.key, points: json.points ?? [] };
    })
  );

  const byTs = new Map<number, ChartPoint>();
  for (const { key, points } of results) {
    for (const p of points) {
      if (p.value === null) continue;
      const existing = byTs.get(p.ts) ?? { ts: p.ts };
      existing[key] = p.value;
      byTs.set(p.ts, existing);
    }
  }
  const sorted = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);

  // Outdoor and indoor readings arrive at different timestamps, so a merged
  // point usually only has ONE series defined - Recharts' default tooltip
  // only lists series present in the exact hovered point, so without this
  // hovering would show just whichever series happened to update at that
  // instant. Carry forward each series' last known value across the merged
  // timeline so every point (once a series has reported at least once) shows
  // all series together.
  const lastKnown: Record<string, number> = {};
  for (const point of sorted) {
    for (const r of requests) {
      if (point[r.key] === undefined) {
        if (r.key in lastKnown) point[r.key] = lastKnown[r.key];
      } else {
        lastKnown[r.key] = point[r.key] as number;
      }
    }
  }

  return sorted;
}

export default function ChartsPage() {
  const [zoneIds, setZoneIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"live" | "range">("live");
  const [rangeMs, setRangeMs] = useState<number>(RANGE_PRESETS[1].ms);
  const [tempData, setTempData] = useState<ChartPoint[]>([]);
  const [humidityData, setHumidityData] = useState<ChartPoint[]>([]);
  // from/to here are the actual query window used for this load() cycle - shared
  // by all three charts below so their x-axes all span the full selected period,
  // not just wherever each chart's own data happens to start/end.
  const [alertData, setAlertData] = useState<{ points: AlertScatterPoint[]; from: number; to: number } | null>(null);
  const [dailyCost, setDailyCost] = useState<DailyCostEntry[]>([]);

  useEffect(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then((json) => setZoneIds((json.zones ?? []).map((z: { zone_id: number }) => z.zone_id)))
      .catch(() => {});
  }, []);

  const refetchDailyCost = useCallback(() => {
    fetch("/api/energy")
      .then((r) => r.json())
      .then((json) => setDailyCost(json.days ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetchDailyCost();
  }, [refetchDailyCost]);

  useLennoxEvent((event) => {
    if (event.type === "zones") refetchDailyCost();
  });

  const { temperature: tempRequests, humidity: humidityRequests } = useMemo(
    () => buildSeriesRequests(zoneIds),
    [zoneIds]
  );

  const load = useCallback(
    (windowMs: number) => {
      const to = Date.now();
      const from = to - windowMs;
      fetchSeries(tempRequests, from, to).then(setTempData);
      fetchSeries(humidityRequests, from, to).then(setHumidityData);
      fetch(`/api/alerts/scatter?from=${from}&to=${to}`)
        .then((r) => r.json())
        .then((json) => setAlertData({ points: json.points ?? [], from, to }))
        .catch(() => {});
    },
    [tempRequests, humidityRequests]
  );

  useEffect(() => {
    if (zoneIds.length === 0 && mode === "live") return;
    load(mode === "live" ? LIVE_WINDOW_MS : rangeMs);
  }, [zoneIds, mode, rangeMs, load]);

  useLennoxEvent((event) => {
    if (mode === "live" && (event.type === "zones" || event.type === "system" || event.type === "alerts")) {
      load(LIVE_WINDOW_MS);
    }
  });

  const tempSeries: ChartSeries[] = tempRequests.map((r) => ({ key: r.key, label: r.label, color: r.color }));
  const humiditySeries: ChartSeries[] = humidityRequests.map((r) => ({ key: r.key, label: r.label, color: r.color }));

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="text-sm px-3 py-1 rounded-full card"
          style={{
            color: mode === "live" ? "var(--surface-1)" : "var(--text-secondary)",
            background: mode === "live" ? "var(--series-1)" : "var(--surface-1)",
          }}
          onClick={() => setMode("live")}
        >
          Live
        </button>
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="text-sm px-3 py-1 rounded-full card"
            style={{
              color: mode === "range" && rangeMs === preset.ms ? "var(--surface-1)" : "var(--text-secondary)",
              background: mode === "range" && rangeMs === preset.ms ? "var(--series-1)" : "var(--surface-1)",
            }}
            onClick={() => {
              setMode("range");
              setRangeMs(preset.ms);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Temperature (°F)
        </h2>
        <LennoxLineChart
          data={tempData}
          series={tempSeries}
          yUnit="°F"
          domain={["dataMin - 3", "dataMax + 3"]}
          xDomain={alertData ? [alertData.from, alertData.to] : undefined}
        />
      </div>

      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Humidity (%)
        </h2>
        <LennoxLineChart
          data={humidityData}
          series={humiditySeries}
          yUnit="%"
          domain={[0, 100]}
          xDomain={alertData ? [alertData.from, alertData.to] : undefined}
        />
      </div>

      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Alert Occurrences
        </h2>
        <AlertScatterChart
          points={alertData?.points ?? []}
          domain={alertData ? { from: alertData.from, to: alertData.to } : undefined}
        />
      </div>

      <div>
        <h2 className="text-sm uppercase mb-1" style={{ color: "var(--text-muted)" }}>
          Estimated Daily AC Cost
        </h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Estimated from cooling runtime x assumed wattage x your electricity rate - not a metered reading.
        </p>
        <DailyCostBarChart days={dailyCost} />
      </div>
    </div>
  );
}
