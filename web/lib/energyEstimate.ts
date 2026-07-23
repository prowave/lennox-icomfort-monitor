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
  /** Cooling runtime weighted by each segment's actual demand (capacity) % - the "effective full-power minutes". */
  effortMinutes: number;
  /** Average demand % while cooling, for display - not used in the cost formula itself. */
  avgDemandPct: number;
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
  const byDate = new Map<string, { coolingMs: number; effortMs: number }>();

  for (let i = 0; i < rows.length; i++) {
    const current = rows[i];
    if (current.temp_operation !== "cooling") continue;
    const next = rows[i + 1];
    const rawEnd = next ? next.ts : now;
    const durationMs = Math.min(rawEnd - current.ts, GAP_CAP_MS);
    if (durationMs <= 0) continue;
    // Readings from before demand was tracked (or a missed report) default to
    // 100% - i.e. the old flat-wattage assumption - rather than silently
    // zeroing out their cost.
    const weight = (current.demand ?? 100) / 100;
    const key = localDateKey(current.ts);
    const entry = byDate.get(key) ?? { coolingMs: 0, effortMs: 0 };
    entry.coolingMs += durationMs;
    entry.effortMs += durationMs * weight;
    byDate.set(key, entry);
  }

  return [...byDate.entries()]
    .map(([date, { coolingMs, effortMs }]) => ({
      date,
      coolingMinutes: coolingMs / 60_000,
      effortMinutes: effortMs / 60_000,
      avgDemandPct: coolingMs > 0 ? (effortMs / coolingMs) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** wattsRunning is the assumed FULL-CAPACITY wattage; effortMinutes already bakes in average demand. */
export function estimateCost(effortMinutes: number, wattsRunning: number, ratePerKwh: number): number {
  return (effortMinutes / 60) * (wattsRunning / 1000) * ratePerKwh;
}
