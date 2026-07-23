"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { LennoxLineChart, type ChartPoint, type ChartSeries } from "@/components/LennoxLineChart";
import { AlertScatterChart } from "@/components/AlertScatterChart";
import {
  LIVE_WINDOW_MS,
  RANGE_PRESETS,
  buildTemperatureRequests,
  fetchSeries,
  perZoneRequests,
} from "@/lib/chartData";
import type { AlertScatterPoint } from "@/lib/types";

export default function ChartsPage() {
  const [zoneIds, setZoneIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"live" | "range">("live");
  const [rangeMs, setRangeMs] = useState<number>(24 * 60 * 60 * 1000);
  const [tempData, setTempData] = useState<ChartPoint[]>([]);
  const [humidityData, setHumidityData] = useState<ChartPoint[]>([]);
  // from/to here are the actual query window used for this load() cycle - shared
  // by all three charts below so their x-axes all span the full selected period,
  // not just wherever each chart's own data happens to start/end.
  const [alertData, setAlertData] = useState<{ points: AlertScatterPoint[]; from: number; to: number } | null>(null);

  useEffect(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then((json) => setZoneIds((json.zones ?? []).map((z: { zone_id: number }) => z.zone_id)))
      .catch(() => {});
  }, []);

  const tempRequests = useMemo(() => buildTemperatureRequests(zoneIds), [zoneIds]);
  const humidityRequests = useMemo(() => perZoneRequests(zoneIds, "humidity"), [zoneIds]);

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
    </div>
  );
}
