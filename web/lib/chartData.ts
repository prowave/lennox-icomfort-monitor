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

/**
 * A gap between two consecutive readings of the same series longer than this
 * means the series actually stopped reporting (normal cadence is well under a
 * minute), as opposed to just being a moment when only another series updated.
 */
export const NO_DATA_GAP_MS = 10 * 60 * 1000;

/** Stretches of a chart's merged timeline wider than a normal reporting cadence - shaded as "no data" by chart components instead of being bridged by a line/area. */
export function findDataGaps(data: ChartPoint[], xDomain?: [number, number]): [number, number][] {
  if (data.length === 0) return [];
  const gaps: [number, number][] = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].ts;
    const curr = data[i].ts;
    if (curr - prev > NO_DATA_GAP_MS) gaps.push([prev, curr]);
  }
  if (xDomain) {
    const [from, to] = xDomain;
    if (data[0].ts - from > NO_DATA_GAP_MS) gaps.unshift([from, data[0].ts]);
    const lastTs = data[data.length - 1].ts;
    if (to - lastTs > NO_DATA_GAP_MS) gaps.push([lastTs, to]);
  }
  return gaps;
}

export async function fetchSeries(requests: SeriesRequest[], from: number, to: number): Promise<ChartPoint[]> {
  const results = await Promise.all(
    requests.map(async (r) => {
      const params = new URLSearchParams({ metric: r.metric, from: String(from), to: String(to) });
      if (r.zoneId !== undefined) params.set("zoneId", String(r.zoneId));
      const res = await fetch(`/api/history?${params.toString()}`);
      const json: { points?: HistoryPoint[] } = await res.json();
      return { key: r.key, points: (json.points ?? []).filter((p) => p.value !== null) };
    })
  );

  const byTs = new Map<number, ChartPoint>();
  const pointAt = (ts: number) => {
    let point = byTs.get(ts);
    if (!point) {
      point = { ts };
      byTs.set(ts, point);
    }
    return point;
  };

  for (const { key, points } of results) {
    for (const p of points) {
      pointAt(p.ts)[key] = p.value;
    }
    // Mark real outages with an explicit null right after the last reading, so
    // the line breaks there instead of Recharts drawing a straight connection
    // across however many hours the series was actually silent.
    for (let i = 1; i < points.length; i++) {
      if (points[i].ts - points[i - 1].ts > NO_DATA_GAP_MS) {
        pointAt(points[i - 1].ts + 1)[key] = null;
      }
    }
  }
  const sorted = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);

  // Outdoor and indoor readings arrive at different timestamps, so a merged
  // point usually only has ONE series defined - Recharts' default tooltip
  // only lists series present in the exact hovered point, so without this
  // hovering would show just whichever series happened to update at that
  // instant. Carry forward each series' last known value across the merged
  // timeline so every point (once a series has reported at least once) shows
  // all series together - but a null (a real outage, marked above) clears it
  // instead of being carried forward, so the gap isn't immediately papered
  // back over with a stale value.
  const lastKnown: Record<string, number> = {};
  for (const point of sorted) {
    for (const r of requests) {
      if (point[r.key] === undefined) {
        if (r.key in lastKnown) point[r.key] = lastKnown[r.key];
      } else if (point[r.key] === null) {
        delete lastKnown[r.key];
      } else {
        lastKnown[r.key] = point[r.key] as number;
      }
    }
  }

  return sorted;
}
