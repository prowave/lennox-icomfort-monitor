import { getZoneOperationTimeline } from "./db";

/**
 * Caps how much runtime a single reading-to-reading gap can contribute. Zone
 * readings arrive on state changes, not a fixed cadence, so a normal gap is
 * seconds to minutes - but a real outage (this app has already seen a ~3-hour
 * polling gap) must not be misattributed as hours of continuous cooling.
 */
const GAP_CAP_MS = 30 * 60 * 1000;

export interface DailyCooling {
  date: string; // YYYY-MM-DD, local calendar day
  coolingMinutes: number;
}

function localDateKey(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Walks the zone's temp_operation timeline and attributes cooling runtime to
 * the calendar day each reading started on. The gap to the *next* reading (or
 * to now, for the most recent one) is the duration credited - capped per the
 * rationale above.
 */
export function computeDailyCoolingMinutes(zoneId: number): DailyCooling[] {
  const rows = getZoneOperationTimeline(zoneId);
  const now = Date.now();
  const byDate = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const current = rows[i];
    if (current.temp_operation !== "cooling") continue;
    const next = rows[i + 1];
    const rawEnd = next ? next.ts : now;
    const durationMs = Math.min(rawEnd - current.ts, GAP_CAP_MS);
    if (durationMs <= 0) continue;
    const key = localDateKey(current.ts);
    byDate.set(key, (byDate.get(key) ?? 0) + durationMs);
  }

  return [...byDate.entries()]
    .map(([date, ms]) => ({ date, coolingMinutes: ms / 60_000 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function estimateCost(coolingMinutes: number, wattsRunning: number, ratePerKwh: number): number {
  return (coolingMinutes / 60) * (wattsRunning / 1000) * ratePerKwh;
}
