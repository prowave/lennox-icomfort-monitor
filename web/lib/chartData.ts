import type { ChartPoint } from "@/components/LennoxLineChart";
import type { HistoryPoint } from "@/lib/types";
import { colorForZone, OUTDOOR_COLOR } from "@/lib/palette";

export const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
export const RANGE_PRESETS = [
  { label: "Last hour", ms: 60 * 60 * 1000 },
  { label: "Last 4 hours", ms: 4 * 60 * 60 * 1000 },
  { label: "Last 8 hours", ms: 8 * 60 * 60 * 1000 },
  { label: "Last 12 hours", ms: 12 * 60 * 60 * 1000 },
  { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
];

export interface SeriesRequest {
  key: string;
  label: string;
  color: string;
  zoneId?: number;
  metric: string;
}

export function perZoneRequests(zoneIds: number[], metric: string): SeriesRequest[] {
  return zoneIds.map((id) => ({
    key: `zone-${id}`,
    label: `Zone ${id}`,
    color: colorForZone(id),
    zoneId: id,
    metric,
  }));
}

export function buildTemperatureRequests(zoneIds: number[]): SeriesRequest[] {
  return [
    { key: "outdoor", label: "Outdoor", color: OUTDOOR_COLOR, metric: "outdoor_temperature" },
    ...perZoneRequests(zoneIds, "temperature"),
  ];
}

export async function fetchSeries(requests: SeriesRequest[], from: number, to: number): Promise<ChartPoint[]> {
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
