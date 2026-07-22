import type { AlertDbRow } from "./types";
import { equipmentTypeName } from "./equipmentTypes";
import { alertCodeName } from "./alertCodes";

const PRIORITY_COLOR: Record<string, string> = {
  critical: "var(--status-critical)",
  serious: "var(--status-serious)",
  moderate: "var(--status-warning)",
  info: "var(--status-good)",
};

export function priorityColor(priority: string | null): string {
  return (priority && PRIORITY_COLOR[priority]) || "var(--text-muted)";
}

export function fmtTimestamp(unixSeconds: string | null): string {
  if (!unixSeconds) return "—";
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

export function equipmentLabel(alert: AlertDbRow): string {
  // The device sometimes reports a more specific name than the fixed enum
  // (e.g. an alert routed through the Subnet Controller but about a
  // particular unit) - prefer that when present.
  if (alert.optional_field_type === "equipmentType" && alert.optional_field_data) {
    return alert.optional_field_data;
  }
  return equipmentTypeName(alert.equipment_type) ?? `Type ${alert.equipment_type}`;
}

export function messageLabel(alert: AlertDbRow): string {
  // The device's own userMessage is sometimes blank, sometimes a near-useless
  // placeholder (e.g. code 425 ships literally "Problem") - our decoded table
  // is comprehensive and specific, so prefer it and only fall back to the
  // device's raw text for the rare code we don't have a name for.
  return alertCodeName(alert.code) || alert.user_message || `Alert code ${alert.code}`;
}
