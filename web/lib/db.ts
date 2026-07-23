import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { AlertRow, EquipmentFeatureRow, SystemRow, WeatherRow, ZoneConfigRow, ZoneRow } from "./parse";

const globalForDb = globalThis as unknown as { lennoxDb?: Database.Database };

// Opened lazily (not at module import time) so `next build`'s page-data
// collection - which imports every route module across several worker
// processes just to read its exports - doesn't have N processes racing to
// open/migrate the same sqlite file.
function getDb(): Database.Database {
  if (globalForDb.lennoxDb) return globalForDb.lennoxDb;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "lennox.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS zone_readings (
      ts INTEGER NOT NULL,
      zone_id INTEGER NOT NULL,
      temperature REAL,
      temperature_c REAL,
      humidity REAL,
      damper REAL,
      demand REAL,
      system_mode TEXT,
      fan_mode TEXT,
      temp_operation TEXT,
      hum_operation TEXT,
      sp REAL, hsp REAL, csp REAL, husp REAL, desp REAL,
      sp_c REAL, hsp_c REAL, csp_c REAL, humidity_mode TEXT, start_time INTEGER,
      defrost INTEGER, aux INTEGER, ssr INTEGER, ventilation INTEGER, fan INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_zone_readings_zone_ts ON zone_readings(zone_id, ts);

    CREATE TABLE IF NOT EXISTS system_readings (
      ts INTEGER NOT NULL,
      outdoor_temperature REAL,
      outdoor_temperature_c REAL,
      outdoor_temperature_status TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_system_readings_ts ON system_readings(ts);

    CREATE TABLE IF NOT EXISTS alerts (
      code INTEGER NOT NULL,
      equipment_type INTEGER NOT NULL,
      identity_ts TEXT NOT NULL,
      timestamp_first TEXT NOT NULL,
      timestamp_last TEXT,
      timestamp_clear TEXT,
      priority TEXT,
      user_message TEXT,
      user_message_id INTEGER,
      is_still_active INTEGER,
      cleared_by TEXT,
      action TEXT,
      update_flag INTEGER,
      notify_user INTEGER,
      notify_dealer INTEGER,
      clearable_by_user INTEGER,
      clearable_by_dealer INTEGER,
      optional_field_type TEXT,
      optional_field_data TEXT,
      count INTEGER,
      raw_json TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (code, equipment_type, identity_ts)
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_still_active, timestamp_last);

    CREATE TABLE IF NOT EXISTS equipment_features (
      equipment_id INTEGER NOT NULL,
      feature_name TEXT NOT NULL,
      fid INTEGER,
      format TEXT,
      unit TEXT,
      values_json TEXT,
      last_seen_ts INTEGER NOT NULL,
      PRIMARY KEY (equipment_id, feature_name)
    );

    CREATE TABLE IF NOT EXISTS current_weather (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ts INTEGER NOT NULL,
      city TEXT,
      state TEXT,
      temperature REAL,
      temperature_c REAL,
      icon_id INTEGER,
      icon_description TEXT,
      cloud_coverage REAL,
      rain_probability REAL
    );

    CREATE TABLE IF NOT EXISTS zone_config (
      zone_id INTEGER PRIMARY KEY,
      min_csp REAL,
      max_csp REAL,
      min_hsp REAL,
      max_hsp REAL,
      schedule_id INTEGER,
      updated_at INTEGER NOT NULL
    );
  `);

  // Additive migration for pre-existing databases: CREATE TABLE IF NOT EXISTS
  // above does nothing once the table already exists, so columns added after
  // the table's first creation need an explicit ALTER TABLE.
  const zoneReadingColumns = new Set(
    (db.pragma("table_info(zone_readings)") as { name: string }[]).map((c) => c.name)
  );
  for (const [column, ddlType] of [
    ["sp_c", "REAL"],
    ["hsp_c", "REAL"],
    ["csp_c", "REAL"],
    ["humidity_mode", "TEXT"],
    ["start_time", "INTEGER"],
  ] as const) {
    if (!zoneReadingColumns.has(column)) {
      db.exec(`ALTER TABLE zone_readings ADD COLUMN ${column} ${ddlType}`);
    }
  }

  const zoneConfigColumns = new Set(
    (db.pragma("table_info(zone_config)") as { name: string }[]).map((c) => c.name)
  );
  if (!zoneConfigColumns.has("schedule_id")) {
    db.exec(`ALTER TABLE zone_config ADD COLUMN schedule_id INTEGER`);
  }

  globalForDb.lennoxDb = db;
  return db;
}

/**
 * The S30 sends partial property-change messages - a message that only
 * changed humidity has null temperature, temp_operation, etc. Inserting that
 * as-is would make the "current status" (the most recent row) flicker blank
 * for fields the latest message simply didn't touch. Carry forward the last
 * known non-null value per field instead, so every stored row is a complete
 * current snapshot. Cached per zone id, stashed on globalThis for the same
 * reason as everything else here - Next.js may run this module more than
 * once as separate instances across route handlers vs. the poller.
 */
function fillNulls<T extends object>(prev: T | undefined, next: T): T {
  if (!prev) return next;
  const merged: T = { ...next };
  for (const key of Object.keys(next) as (keyof T)[]) {
    if ((merged[key] === null || merged[key] === undefined) && prev[key] !== null && prev[key] !== undefined) {
      merged[key] = prev[key];
    }
  }
  return merged;
}

const globalForZoneState = globalThis as unknown as { lennoxLastZoneState?: Map<number, ZoneRow> };
const lastZoneState: Map<number, ZoneRow> = globalForZoneState.lennoxLastZoneState ?? new Map();
globalForZoneState.lennoxLastZoneState = lastZoneState;

let insertZoneStmt: Database.Statement | null = null;
export function insertZoneReadings(rows: ZoneRow[]): void {
  const db = getDb();
  insertZoneStmt ??= db.prepare(`
    INSERT INTO zone_readings
      (ts, zone_id, temperature, temperature_c, humidity, damper, demand, system_mode, fan_mode,
       temp_operation, hum_operation, sp, sp_c, hsp, hsp_c, csp, csp_c, husp, desp, humidity_mode,
       start_time, defrost, aux, ssr, ventilation, fan)
    VALUES
      (@ts, @zoneId, @temperature, @temperatureC, @humidity, @damper, @demand, @systemMode, @fanMode,
       @tempOperation, @humOperation, @sp, @spC, @hsp, @hspC, @csp, @cspC, @husp, @desp, @humidityMode,
       @startTime, @defrost, @aux, @ssr, @ventilation, @fan)
  `);
  const stmt = insertZoneStmt;
  const tx = db.transaction((items: ZoneRow[]) => {
    for (const raw of items) {
      const r = fillNulls(lastZoneState.get(raw.zoneId), raw);
      lastZoneState.set(raw.zoneId, r);
      stmt.run({
        ...r,
        defrost: boolToInt(r.defrost),
        aux: boolToInt(r.aux),
        ssr: boolToInt(r.ssr),
        ventilation: boolToInt(r.ventilation),
        fan: boolToInt(r.fan),
      });
    }
  });
  tx(rows);
}

const globalForSystemState = globalThis as unknown as { lennoxLastSystemState?: SystemRow };
let lastSystemState: SystemRow | undefined = globalForSystemState.lennoxLastSystemState;

let insertSystemStmt: Database.Statement | null = null;
export function insertSystemReading(raw: SystemRow): void {
  const db = getDb();
  insertSystemStmt ??= db.prepare(`
    INSERT INTO system_readings (ts, outdoor_temperature, outdoor_temperature_c, outdoor_temperature_status)
    VALUES (@ts, @outdoorTemperature, @outdoorTemperatureC, @outdoorTemperatureStatus)
  `);
  const row = fillNulls(lastSystemState, raw);
  lastSystemState = row;
  globalForSystemState.lennoxLastSystemState = row;
  insertSystemStmt.run(row);
}

let upsertWeatherStmt: Database.Statement | null = null;
export function upsertWeather(row: WeatherRow): void {
  const db = getDb();
  upsertWeatherStmt ??= db.prepare(`
    INSERT INTO current_weather (id, ts, city, state, temperature, temperature_c, icon_id, icon_description, cloud_coverage, rain_probability)
    VALUES (1, @ts, @city, @state, @temperature, @temperatureC, @iconId, @iconDescription, @cloudCoverage, @rainProbability)
    ON CONFLICT (id) DO UPDATE SET
      ts = excluded.ts,
      city = excluded.city,
      state = excluded.state,
      temperature = excluded.temperature,
      temperature_c = excluded.temperature_c,
      icon_id = excluded.icon_id,
      icon_description = excluded.icon_description,
      cloud_coverage = excluded.cloud_coverage,
      rain_probability = excluded.rain_probability
  `);
  upsertWeatherStmt.run(row);
}

export function getCurrentWeather() {
  return getDb().prepare(`SELECT * FROM current_weather WHERE id = 1`).get();
}

let upsertZoneConfigStmt: Database.Statement | null = null;
export function upsertZoneConfigs(rows: ZoneConfigRow[], updatedAt: number): void {
  const db = getDb();
  upsertZoneConfigStmt ??= db.prepare(`
    INSERT INTO zone_config (zone_id, min_csp, max_csp, min_hsp, max_hsp, schedule_id, updated_at)
    VALUES (@zoneId, @minCsp, @maxCsp, @minHsp, @maxHsp, @scheduleId, @updatedAt)
    ON CONFLICT (zone_id) DO UPDATE SET
      min_csp = excluded.min_csp,
      max_csp = excluded.max_csp,
      min_hsp = excluded.min_hsp,
      max_hsp = excluded.max_hsp,
      schedule_id = excluded.schedule_id,
      updated_at = excluded.updated_at
  `);
  const stmt = upsertZoneConfigStmt;
  const tx = db.transaction((items: ZoneConfigRow[]) => {
    for (const r of items) {
      stmt.run({ ...r, updatedAt });
    }
  });
  tx(rows);
}

export function getZoneConfig(zoneId: number) {
  return getDb().prepare(`SELECT * FROM zone_config WHERE zone_id = ?`).get(zoneId);
}

export function getAllZoneConfigs() {
  return getDb().prepare(`SELECT * FROM zone_config ORDER BY zone_id`).all();
}

let upsertAlertStmt: Database.Statement | null = null;
export function upsertAlerts(rows: AlertRow[], updatedAt: number): void {
  const db = getDb();
  upsertAlertStmt ??= db.prepare(`
    INSERT INTO alerts
      (code, equipment_type, identity_ts, timestamp_first, timestamp_last, timestamp_clear, priority,
       user_message, user_message_id, is_still_active, cleared_by, action, update_flag, notify_user,
       notify_dealer, clearable_by_user, clearable_by_dealer, optional_field_type, optional_field_data,
       count, raw_json, updated_at)
    VALUES
      (@code, @equipmentType, @identityTs, @timestampFirst, @timestampLast, @timestampClear, @priority,
       @userMessage, @userMessageId, @isStillActive, @clearedBy, @action, @update, @notifyUser,
       @notifyDealer, @clearableByUser, @clearableByDealer, @optionalFieldType, @optionalFieldData,
       @count, @rawJson, @updatedAt)
    ON CONFLICT (code, equipment_type, identity_ts) DO UPDATE SET
      timestamp_last = excluded.timestamp_last,
      timestamp_clear = excluded.timestamp_clear,
      priority = excluded.priority,
      user_message = excluded.user_message,
      user_message_id = excluded.user_message_id,
      is_still_active = excluded.is_still_active,
      cleared_by = excluded.cleared_by,
      action = excluded.action,
      update_flag = excluded.update_flag,
      notify_user = excluded.notify_user,
      notify_dealer = excluded.notify_dealer,
      clearable_by_user = excluded.clearable_by_user,
      clearable_by_dealer = excluded.clearable_by_dealer,
      optional_field_type = excluded.optional_field_type,
      optional_field_data = excluded.optional_field_data,
      count = excluded.count,
      raw_json = excluded.raw_json,
      updated_at = excluded.updated_at
  `);
  const stmt = upsertAlertStmt;
  const tx = db.transaction((items: AlertRow[]) => {
    for (const r of items) {
      stmt.run({
        ...r,
        isStillActive: boolToInt(r.isStillActive),
        update: boolToInt(r.update),
        notifyUser: boolToInt(r.notifyUser),
        notifyDealer: boolToInt(r.notifyDealer),
        clearableByUser: boolToInt(r.clearableByUser),
        clearableByDealer: boolToInt(r.clearableByDealer),
        updatedAt,
      });
    }
  });
  tx(rows);
}

let upsertFeatureStmt: Database.Statement | null = null;
export function upsertEquipmentFeatures(rows: EquipmentFeatureRow[], lastSeenTs: number): void {
  const db = getDb();
  upsertFeatureStmt ??= db.prepare(`
    INSERT INTO equipment_features (equipment_id, feature_name, fid, format, unit, values_json, last_seen_ts)
    VALUES (@equipmentId, @featureName, @fid, @format, @unit, @valuesJson, @lastSeenTs)
    ON CONFLICT (equipment_id, feature_name) DO UPDATE SET
      fid = excluded.fid,
      format = excluded.format,
      unit = excluded.unit,
      values_json = excluded.values_json,
      last_seen_ts = excluded.last_seen_ts
  `);
  const stmt = upsertFeatureStmt;
  const tx = db.transaction((items: EquipmentFeatureRow[]) => {
    for (const r of items) {
      stmt.run({ ...r, lastSeenTs });
    }
  });
  tx(rows);
}

function boolToInt(v: boolean | null): number | null {
  if (v === null) return null;
  return v ? 1 : 0;
}

/** Used by scripts/backfill-readings.ts before re-importing from the jsonl log. */
export function clearReadings(): void {
  getDb().exec("DELETE FROM zone_readings; DELETE FROM system_readings;");
}

// --- Read helpers for the API routes ---

export function getLatestZoneSnapshot() {
  return getDb()
    .prepare(
      `SELECT zr.* FROM zone_readings zr
       JOIN (SELECT zone_id, MAX(ts) AS max_ts FROM zone_readings GROUP BY zone_id) latest
         ON zr.zone_id = latest.zone_id AND zr.ts = latest.max_ts
       ORDER BY zr.zone_id`
    )
    .all();
}

export function getLatestSystemReading() {
  return getDb().prepare(`SELECT * FROM system_readings ORDER BY ts DESC LIMIT 1`).get();
}

export function getActiveAlerts() {
  return getDb()
    .prepare(
      `SELECT * FROM alerts WHERE is_still_active = 1 AND (priority IS NULL OR priority != 'info')
       ORDER BY timestamp_last DESC`
    )
    .all();
}

// Active info-priority notices, surfaced separately (a Dashboard card) since
// they're not actionable enough to count as an "active alert" but shouldn't
// be invisible either.
export function getActiveInfoAlerts() {
  return getDb()
    .prepare(`SELECT * FROM alerts WHERE is_still_active = 1 AND priority = 'info' ORDER BY timestamp_last DESC`)
    .all();
}

// Info-priority alerts are informational notices, not actionable - they never
// count as "active" (see getActiveAlerts), but they're still worth being able
// to browse, so they always show up here regardless of is_still_active.
export function getAlertHistory(limit = 200) {
  return getDb()
    .prepare(
      `SELECT * FROM alerts WHERE is_still_active = 0 OR priority = 'info'
       ORDER BY timestamp_last DESC LIMIT ?`
    )
    .all(limit);
}

interface AlertIdentity {
  code: number;
  equipment_type: number;
  identity_ts: string;
}

export function getActiveAlertIdentities(): AlertIdentity[] {
  return getDb()
    .prepare(`SELECT code, equipment_type, identity_ts FROM alerts WHERE is_still_active = 1`)
    .all() as AlertIdentity[];
}

/**
 * Closes out alerts we have marked active that a fresh device snapshot no
 * longer mentions at all - the device has moved past them (cleared or aged
 * out of its own buffer) during a gap we didn't capture. Marked distinctly
 * from a real device-confirmed clear so it's never mistaken for one.
 */
export function closeStaleAlerts(identities: AlertIdentity[], updatedAt: number): void {
  if (!identities.length) return;
  const db = getDb();
  const stmt = db.prepare(
    `UPDATE alerts SET is_still_active = 0, cleared_by = 'presumed (monitoring gap)', updated_at = @updatedAt
     WHERE code = @code AND equipment_type = @equipmentType AND identity_ts = @identityTs`
  );
  const tx = db.transaction((items: AlertIdentity[]) => {
    for (const i of items) {
      stmt.run({ code: i.code, equipmentType: i.equipment_type, identityTs: i.identity_ts, updatedAt });
    }
  });
  tx(identities);
}

export function getEquipmentSnapshot() {
  return getDb()
    .prepare(`SELECT * FROM equipment_features ORDER BY equipment_id, feature_name`)
    .all();
}

const HISTORY_COLUMNS = new Set(["temperature", "temperature_c", "humidity", "damper", "demand"]);

export function getZoneHistory(zoneId: number, metric: string, fromTs: number, toTs: number) {
  if (!HISTORY_COLUMNS.has(metric)) {
    throw new Error(`Unsupported metric: ${metric}`);
  }
  return getDb()
    .prepare(
      `SELECT ts, ${metric} AS value FROM zone_readings
       WHERE zone_id = ? AND ts BETWEEN ? AND ?
       ORDER BY ts`
    )
    .all(zoneId, fromTs, toTs);
}

/** Maps temp_operation to a 0/1 signal (1 = actively cooling), for a digital on/off chart. */
export function getZoneCoolingHistory(zoneId: number, fromTs: number, toTs: number) {
  return getDb()
    .prepare(
      `SELECT ts, CASE WHEN temp_operation = 'cooling' THEN 1 ELSE 0 END AS value
       FROM zone_readings
       WHERE zone_id = ? AND ts BETWEEN ? AND ?
       ORDER BY ts`
    )
    .all(zoneId, fromTs, toTs);
}

export function getOutdoorTemperatureHistory(fromTs: number, toTs: number) {
  return getDb()
    .prepare(
      `SELECT ts, outdoor_temperature AS value FROM system_readings
       WHERE ts BETWEEN ? AND ?
       ORDER BY ts`
    )
    .all(fromTs, toTs);
}

// timestamp_last is the device's own unix-seconds string, not the epoch-ms
// `ts` columns used elsewhere - compare by casting to a millisecond value.
export function getAlertsForScatter(fromMs: number, toMs: number) {
  return getDb()
    .prepare(
      `SELECT code, equipment_type, priority, user_message, timestamp_last
       FROM alerts
       WHERE timestamp_last IS NOT NULL
         AND CAST(timestamp_last AS INTEGER) * 1000 BETWEEN ? AND ?
       ORDER BY timestamp_last`
    )
    .all(fromMs, toMs);
}

/** Full temp_operation + demand timeline for one zone, oldest first - used to derive runtime and effort for the AC cost estimate. */
export function getZoneOperationTimeline(
  zoneId: number
): { ts: number; temp_operation: string | null; demand: number | null }[] {
  return getDb()
    .prepare(`SELECT ts, temp_operation, demand FROM zone_readings WHERE zone_id = ? ORDER BY ts`)
    .all(zoneId) as { ts: number; temp_operation: string | null; demand: number | null }[];
}
