/** Fixed categorical slot order - color follows the entity (zone id / outdoor), never re-cycled. */
export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

export function colorForZone(zoneId: number): string {
  // Slot 1 is reserved for outdoor temperature on the temperature chart, so zones start at slot 2.
  return SERIES_COLORS[(zoneId + 1) % SERIES_COLORS.length];
}

export const OUTDOOR_COLOR = SERIES_COLORS[0];

/** Cooling is always this ice blue, regardless of zone - it's a system state, not a per-zone identity. */
export const ICE_COLOR = "var(--ice)";
