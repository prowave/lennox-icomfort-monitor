import { SERIES_COLORS } from "./palette";
import type { AlertScatterPoint } from "./types";

// Fixed, sensible display order - filtered down to whichever equipment types
// actually appear in the current data, so the y-axis never shows empty rows.
const EQUIPMENT_DISPLAY_ORDER = [0, 16, 17, 18, 19, 22];

const OTHER_COLOR = "var(--text-muted)";
const MAX_COLORED_CODES = 3; // scatter is an all-pairs form - dataviz skill caps categorical hues at 3 here

export interface EquipmentBand {
  equipmentType: number;
  label: string;
  y: number;
}

export function buildEquipmentBands(points: AlertScatterPoint[]): EquipmentBand[] {
  const present = new Map<number, string>();
  for (const p of points) present.set(p.equipmentType, p.equipmentLabel);

  const ordered = EQUIPMENT_DISPLAY_ORDER.filter((t) => present.has(t));
  const rest = [...present.keys()].filter((t) => !EQUIPMENT_DISPLAY_ORDER.includes(t)).sort((a, b) => a - b);
  const all = [...ordered, ...rest];

  return all.map((equipmentType, i) => ({
    equipmentType,
    label: present.get(equipmentType) ?? `Type ${equipmentType}`,
    y: i,
  }));
}

export interface CodeColorEntry {
  code: number;
  label: string;
  color: string;
}

/** Assigns fixed categorical slots to the most common codes; the rest fold into "Other" (never a 4th generated hue). */
export function buildCodeColors(points: AlertScatterPoint[]): CodeColorEntry[] {
  const counts = new Map<number, { label: string; count: number }>();
  for (const p of points) {
    const existing = counts.get(p.code);
    if (existing) existing.count++;
    else counts.set(p.code, { label: p.codeLabel, count: 1 });
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  const colored = sorted.slice(0, MAX_COLORED_CODES);
  const overflow = sorted.slice(MAX_COLORED_CODES);

  const entries: CodeColorEntry[] = colored.map(([code, { label }], i) => ({
    code,
    label: `${code} - ${label}`,
    color: SERIES_COLORS[i],
  }));

  if (overflow.length > 0) {
    entries.push({ code: -1, label: "Other", color: OTHER_COLOR });
  }

  return entries;
}

/** Deterministic pseudo-random jitter in [-amplitude, amplitude], stable across re-renders for the same point. */
export function jitterFor(seed: string, amplitude: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const unit = (hash % 1000) / 1000; // roughly uniform in [-1, 1)
  return unit * amplitude;
}
