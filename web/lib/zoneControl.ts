import { getLatestZoneSnapshot, getZoneConfig } from "./db";
import type { ZoneReadingRow } from "./types";

// Conservative fallback bounds, used only until the device's own zone_config
// (minCsp/maxCsp/minHsp/maxHsp) has arrived at least once.
const DEFAULT_MIN_CSP = 60;
const DEFAULT_MAX_CSP = 90;
const DEFAULT_MIN_HSP = 45;
const DEFAULT_MAX_HSP = 80;

// Lennox's own changeover deadband convention - heat and cool setpoints must
// stay at least this far apart, or the system would rapidly cycle.
const MIN_HEAT_COOL_SEPARATION_F = 3;

// Deterministic per Lennox's schedule model: manual-hold and override
// schedules for a zone are always these fixed offsets from its zone id
// (verified against this system's real config: scheduleId 16 for zone 0 -
// exactly 16 + zoneId - while the zone was in manual mode).
function manualModeScheduleId(zoneId: number): number {
  return 16 + zoneId;
}
function overrideScheduleId(zoneId: number): number {
  return 32 + zoneId;
}
function awayModeScheduleId(zoneId: number): number {
  return 24 + zoneId;
}

/**
 * If the zone is already in manual/override/away mode, its current
 * scheduleId already IS one of those temporary schedules - update that same
 * one directly. Otherwise it's following a real named schedule, and writing
 * straight into that would permanently change the program rather than
 * create a temporary override - so target the override schedule instead.
 */
function resolveTargetScheduleId(zoneId: number, currentScheduleId: number | null): number {
  if (
    currentScheduleId === manualModeScheduleId(zoneId) ||
    currentScheduleId === overrideScheduleId(zoneId) ||
    currentScheduleId === awayModeScheduleId(zoneId)
  ) {
    return currentScheduleId;
  }
  return overrideScheduleId(zoneId);
}

function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}

export interface SetpointRequest {
  zoneId: number;
  hsp?: number;
  csp?: number;
}

export type SetpointResult = { ok: true; payload: Record<string, unknown> } | { ok: false; error: string };

export function buildSetpointPayload(req: SetpointRequest): SetpointResult {
  if (req.hsp === undefined && req.csp === undefined) {
    return { ok: false, error: "Must specify hsp and/or csp" };
  }
  if (req.hsp !== undefined && !Number.isFinite(req.hsp)) {
    return { ok: false, error: "hsp must be a number" };
  }
  if (req.csp !== undefined && !Number.isFinite(req.csp)) {
    return { ok: false, error: "csp must be a number" };
  }

  const zones = getLatestZoneSnapshot() as ZoneReadingRow[];
  const zone = zones.find((z) => z.zone_id === req.zoneId);
  if (!zone) {
    return { ok: false, error: `No known reading for zone ${req.zoneId} yet` };
  }

  const config = getZoneConfig(req.zoneId) as
    | {
        min_csp: number | null;
        max_csp: number | null;
        min_hsp: number | null;
        max_hsp: number | null;
        schedule_id: number | null;
      }
    | undefined;
  const minCsp = config?.min_csp ?? DEFAULT_MIN_CSP;
  const maxCsp = config?.max_csp ?? DEFAULT_MAX_CSP;
  const minHsp = config?.min_hsp ?? DEFAULT_MIN_HSP;
  const maxHsp = config?.max_hsp ?? DEFAULT_MAX_HSP;

  if (req.csp !== undefined && (req.csp < minCsp || req.csp > maxCsp)) {
    return { ok: false, error: `Cool setpoint must be between ${minCsp} and ${maxCsp}` };
  }
  if (req.hsp !== undefined && (req.hsp < minHsp || req.hsp > maxHsp)) {
    return { ok: false, error: `Heat setpoint must be between ${minHsp} and ${maxHsp}` };
  }

  const nextCsp = req.csp ?? zone.csp;
  const nextHsp = req.hsp ?? zone.hsp;
  if (nextCsp !== null && nextHsp !== null && nextCsp - nextHsp < MIN_HEAT_COOL_SEPARATION_F) {
    return {
      ok: false,
      error: `Cool and heat setpoints must be at least ${MIN_HEAT_COOL_SEPARATION_F}°F apart`,
    };
  }

  const targetScheduleId = resolveTargetScheduleId(req.zoneId, config?.schedule_id ?? null);

  // Copy forward every other period field unchanged, so this write only
  // touches the setpoint(s) actually requested.
  const period: Record<string, unknown> = {
    systemMode: zone.system_mode,
    fanMode: zone.fan_mode,
    humidityMode: zone.humidity_mode,
    startTime: zone.start_time ?? 0,
    husp: zone.husp,
    desp: zone.desp,
    sp: zone.sp,
    spC: zone.sp_c,
    hsp: nextHsp,
    hspC: req.hsp !== undefined ? fahrenheitToCelsius(req.hsp) : zone.hsp_c,
    csp: nextCsp,
    cspC: req.csp !== undefined ? fahrenheitToCelsius(req.csp) : zone.csp_c,
  };

  return {
    ok: true,
    payload: {
      schedules: [
        {
          schedule: { periods: [{ id: 0, period }] },
          id: targetScheduleId,
        },
      ],
    },
  };
}
