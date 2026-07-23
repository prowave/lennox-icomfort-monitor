"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { LennoxLineChart, type ChartPoint, type ChartSeries } from "@/components/LennoxLineChart";
import { DigitalStateChart } from "@/components/DigitalStateChart";
import { DailyCostBarChart } from "@/components/DailyCostBarChart";
import { LIVE_WINDOW_MS, RANGE_PRESETS, fetchSeries, perZoneRequests } from "@/lib/chartData";
import { ICE_COLOR } from "@/lib/palette";
import type { DailyCostEntry } from "@/lib/types";

export default function EnergyPage() {
  const [zoneIds, setZoneIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"live" | "range">("live");
  const [rangeMs, setRangeMs] = useState<number>(24 * 60 * 60 * 1000);
  const [coolingData, setCoolingData] = useState<ChartPoint[]>([]);
  const [demandData, setDemandData] = useState<ChartPoint[]>([]);
  // The actual query window used for this load() cycle - shared by both charts
  // below so their x-axes span the full selected period, not just wherever
  // each chart's own data happens to start/end.
  const [queryWindow, setQueryWindow] = useState<{ from: number; to: number } | null>(null);
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

  const coolingRequests = useMemo(() => perZoneRequests(zoneIds, "cooling"), [zoneIds]);
  const demandRequests = useMemo(() => perZoneRequests(zoneIds, "demand"), [zoneIds]);

  const load = useCallback(
    (queryWindowMs: number) => {
      const to = Date.now();
      const from = to - queryWindowMs;
      fetchSeries(coolingRequests, from, to).then((points) => {
        setCoolingData(points);
        setQueryWindow({ from, to });
      });
      fetchSeries(demandRequests, from, to).then(setDemandData);
    },
    [coolingRequests, demandRequests]
  );

  useEffect(() => {
    if (zoneIds.length === 0 && mode === "live") return;
    load(mode === "live" ? LIVE_WINDOW_MS : rangeMs);
  }, [zoneIds, mode, rangeMs, load]);

  useLennoxEvent((event) => {
    if (mode === "live" && (event.type === "zones" || event.type === "system")) {
      load(LIVE_WINDOW_MS);
    }
  });

  const coolingSeries: ChartSeries[] = coolingRequests.map((r) => ({ key: r.key, label: r.label, color: ICE_COLOR }));
  const demandSeries: ChartSeries[] = demandRequests.map((r) => ({
    key: r.key,
    label: r.label,
    color: r.color,
    gradient: true,
  }));

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
          System Cooling
        </h2>
        <DigitalStateChart
          data={coolingData}
          series={coolingSeries}
          onLabel="Cooling"
          offLabel="Off"
          xDomain={queryWindow ? [queryWindow.from, queryWindow.to] : undefined}
        />
      </div>

      <div>
        <h2 className="text-sm uppercase mb-1" style={{ color: "var(--text-muted)" }}>
          Effort (%)
        </h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Capacity demand while running - how hard the system is working, not just whether it&apos;s on.
        </p>
        <LennoxLineChart
          data={demandData}
          series={demandSeries}
          yUnit="%"
          domain={[0, 100]}
          xDomain={queryWindow ? [queryWindow.from, queryWindow.to] : undefined}
        />
      </div>

      <div>
        <h2 className="text-sm uppercase mb-1" style={{ color: "var(--text-muted)" }}>
          Estimated Daily AC Cost
        </h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Estimated from cooling runtime weighted by average compressor effort x assumed full-power wattage x your
          electricity rate - not a metered reading.
        </p>
        <DailyCostBarChart days={dailyCost} />
      </div>
    </div>
  );
}
