// One-off backfill: replay the existing lennox_log.jsonl through the real
// zone/system parsers to give the charts real historical depth, instead of
// only what's accumulated since the last server restart. Clears and
// re-imports zone_readings/system_readings from scratch (the jsonl is the
// full authoritative record, so nothing is lost). Run with:
//   npx tsx scripts/backfill-readings.ts <path-to-lennox_log.jsonl>
import fs from "node:fs";
import readline from "node:readline";
import { parseZones, parseSystem } from "../lib/parse";
import { insertZoneReadings, insertSystemReading, clearReadings } from "../lib/db";

async function main() {
  const logPath = process.argv[2];
  if (!logPath) {
    console.error("usage: tsx scripts/backfill-readings.ts <path-to-lennox_log.jsonl>");
    process.exit(1);
  }

  clearReadings();

  const rl = readline.createInterface({
    input: fs.createReadStream(logPath, "utf8"),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let zoneRows = 0;
  let systemRows = 0;

  for await (const line of rl) {
    lineCount++;
    if (!line.trim()) continue;
    let obj: { logged_at?: string; message?: { Data?: Record<string, unknown> } };
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const data = obj.message?.Data;
    if (!data) continue;

    const loggedAtMs = obj.logged_at ? Date.parse(obj.logged_at) : Date.now();
    const ts = Number.isFinite(loggedAtMs) ? loggedAtMs : Date.now();

    if (data.zones) {
      const rows = parseZones(data, ts);
      if (rows.length) {
        insertZoneReadings(rows);
        zoneRows += rows.length;
      }
    }
    if (data.system) {
      const row = parseSystem(data, ts);
      if (row) {
        insertSystemReading(row);
        systemRows++;
      }
    }
  }

  console.log(JSON.stringify({ lineCount, zoneRows, systemRows }));
}

main();
