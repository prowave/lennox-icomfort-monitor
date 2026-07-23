import fs from "node:fs";
import path from "node:path";
import { LennoxClient, type LennoxMessage } from "./lennoxClient";
import { publish } from "./bus";
import {
  redactMessage,
  parseZones,
  parseZoneConfigs,
  parseSystem,
  parseAlerts,
  parseEquipmentFeatures,
  parseEquipmentDiagnostics,
  parseWeather,
} from "./parse";
import {
  insertZoneReadings,
  insertSystemReading,
  upsertAlerts,
  upsertEquipmentFeatures,
  upsertEquipmentDiagnostics,
  upsertWeather,
  upsertZoneConfigs,
  getActiveAlertIdentities,
  closeStaleAlerts,
} from "./db";

const DEFAULT_JSON_PATH = "1;/systemControl;/alerts/active;/alerts/meta;/equipments;/system;/zones";

const LOG_FILE =
  process.env.LENNOX_LOG_FILE ?? path.resolve(process.cwd(), "..", "lennox_log.jsonl");

// Stashed on globalThis, same reason as lennoxPollerStarted below: Next.js
// bundles the instrumentation hook and each API route as separate module
// instances, so plain module-level `let`s here would never be visible to a
// route handler's own copy - it would read stale defaults forever even while
// the real poller (in its own instance) keeps them current.
interface PollerStatus {
  lastMessageAt: number | null;
  connected: boolean;
}
const globalForStatus = globalThis as unknown as { lennoxPollerStatus?: PollerStatus };
const status: PollerStatus = globalForStatus.lennoxPollerStatus ?? { lastMessageAt: null, connected: false };
globalForStatus.lennoxPollerStatus = status;

export function getPollerStatus(): PollerStatus {
  return { ...status };
}

// Stashed on globalThis for the same reason as `status` above - an API route
// requesting an on-demand refresh runs in a separate module instance from the
// poller loop that actually created this client.
const globalForClient = globalThis as unknown as { lennoxPollerClient?: LennoxClient };

/**
 * Re-issues a RequestData for just /equipments on the poller's already-open
 * session. This is exactly what a fresh reconnect does for the whole tree
 * (which is how the "waiting..." diagnostics were observed to eventually
 * fill in) - scoped down to only the equipment subtree so it doesn't also
 * force a full alerts/zones re-dump. It asks the S30 to push whatever it
 * currently has; if the outdoor unit hasn't reported a live value to the LCC
 * recently, the pushed value may still legitimately be "waiting...".
 */
export async function requestDiagnosticsRefresh(): Promise<{ ok: boolean; error?: string }> {
  const client = globalForClient.lennoxPollerClient;
  if (!client) return { ok: false, error: "Poller is not connected yet" };
  try {
    await client.subscribe("/equipments");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function appendToLog(msg: LennoxMessage): void {
  const line = { logged_at: new Date().toISOString(), message: msg };
  fs.appendFile(LOG_FILE, JSON.stringify(line) + "\n", (err) => {
    if (err) console.error(`[poller] failed to write ${LOG_FILE}:`, err.message);
  });
}

// Set true on every successful connect/reconnect. The S30 resends a full
// state dump right after (re)subscribing, so the *next* alerts-bearing
// message is trustworthy ground truth for reconciliation - unlike normal
// incremental messages, which are small deltas and would wrongly look like
// everything else went away. Cleared after that one message is processed.
let awaitingReconciliation = false;

function reconcileActiveAlerts(data: Record<string, unknown>, ts: number): void {
  const freshRows = parseAlerts(data);
  const presentIdentities = new Set(freshRows.map((r) => `${r.code}-${r.equipmentType}-${r.identityTs}`));

  const ours = getActiveAlertIdentities();
  const stale = ours.filter((a) => !presentIdentities.has(`${a.code}-${a.equipment_type}-${a.identity_ts}`));

  if (stale.length) {
    closeStaleAlerts(stale, ts);
    console.log(`[poller] reconciliation closed ${stale.length} stale active alert(s) after reconnect`);
    publish({ type: "alerts", ts });
  }
}

function handleMessage(msg: LennoxMessage): void {
  redactMessage(msg);
  appendToLog(msg);

  const data = msg.Data;
  if (!data) return;
  const ts = Date.now();

  if (data.zones) {
    const rows = parseZones(data, ts);
    if (rows.length) {
      insertZoneReadings(rows);
      publish({ type: "zones", ts });
    }
    const configRows = parseZoneConfigs(data);
    if (configRows.length) {
      upsertZoneConfigs(configRows, ts);
    }
  }
  if (data.system) {
    const row = parseSystem(data, ts);
    if (row) {
      insertSystemReading(row);
      publish({ type: "system", ts });
    }
  }
  if (data.alerts) {
    const rows = parseAlerts(data);
    if (rows.length) {
      upsertAlerts(rows, ts);
      publish({ type: "alerts", ts });
    }
    if (awaitingReconciliation) {
      awaitingReconciliation = false;
      reconcileActiveAlerts(data, ts);
    }
  }
  if (data.equipments) {
    const rows = parseEquipmentFeatures(data);
    if (rows.length) {
      upsertEquipmentFeatures(rows, ts);
      publish({ type: "equipment", ts });
    }
    const diagnosticRows = parseEquipmentDiagnostics(data);
    if (diagnosticRows.length) {
      upsertEquipmentDiagnostics(diagnosticRows, ts);
      publish({ type: "equipment", ts });
    }
  }
  if (data.weather) {
    const row = parseWeather(data, ts);
    if (row) {
      upsertWeather(row);
      publish({ type: "weather", ts });
    }
  }
}

async function pollLoop(client: LennoxClient, jsonPath: string, longPoll: number): Promise<void> {
  let consecutiveFailures = 0;

  for (;;) {
    let messages: LennoxMessage[];
    try {
      messages = await client.retrieveOnce(longPoll);
      consecutiveFailures = 0;
      status.connected = true;
    } catch (e) {
      consecutiveFailures += 1;
      status.connected = false;
      console.error(`[poller] retrieve failed (${consecutiveFailures}):`, (e as Error).message);
      await sleep(5000);
      if (consecutiveFailures >= 3) {
        console.error("[poller] multiple failures - reconnecting session...");
        if (await client.reconnect(jsonPath)) {
          consecutiveFailures = 0;
          status.connected = true;
          awaitingReconciliation = true;
        }
      }
      publish({ type: "heartbeat", ts: Date.now(), connected: status.connected });
      continue;
    }

    for (const msg of messages) {
      status.lastMessageAt = Date.now();
      try {
        handleMessage(msg);
      } catch (e) {
        console.error("[poller] failed to handle message:", (e as Error).message);
      }
    }
    publish({ type: "heartbeat", ts: Date.now(), connected: status.connected });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Stashed on globalThis so a Next.js dev-mode module reload doesn't spin up a second
// concurrent poller against the same physical unit.
const globalForPoller = globalThis as unknown as { lennoxPollerStarted?: boolean };

export function startPoller(): void {
  if (globalForPoller.lennoxPollerStarted) return;
  globalForPoller.lennoxPollerStarted = true;

  const ip = process.env.LENNOX_IP;
  if (!ip) {
    console.error("[poller] LENNOX_IP is not set - poller will not start. Set it in .env.local.");
    globalForPoller.lennoxPollerStarted = false;
    return;
  }
  const appId = process.env.LENNOX_APP_ID ?? "nextjs_dashboard";
  const longPoll = Number(process.env.LENNOX_LONG_POLL ?? 10);
  const jsonPath = process.env.LENNOX_JSON_PATH ?? DEFAULT_JSON_PATH;

  const client = new LennoxClient(ip, appId);
  globalForClient.lennoxPollerClient = client;

  (async () => {
    try {
      await client.connect();
      await client.subscribe(jsonPath);
      status.connected = true;
      awaitingReconciliation = true;
      console.log(`[poller] connected to ${ip} as ${appId}, logging to ${LOG_FILE}`);
    } catch (e) {
      console.error("[poller] failed to connect/subscribe:", (e as Error).message);
    }
    await pollLoop(client, jsonPath, longPoll);
  })().catch((e) => {
    console.error("[poller] fatal error, poll loop exited:", e);
    globalForPoller.lennoxPollerStarted = false;
  });
}
