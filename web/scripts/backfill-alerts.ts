// One-off backfill: replay the existing lennox_log.jsonl through the real
// alert parser/upsert logic to rebuild full alert history after a schema fix,
// instead of losing everything the app had already logged. Run with:
//   npx tsx scripts/backfill-alerts.ts <path-to-lennox_log.jsonl>
import fs from "node:fs";
import readline from "node:readline";
import { parseAlerts } from "../lib/parse";
import { upsertAlerts } from "../lib/db";

async function main() {
  const logPath = process.argv[2];
  if (!logPath) {
    console.error("usage: tsx scripts/backfill-alerts.ts <path-to-lennox_log.jsonl>");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(logPath, "utf8"),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let alertMessageCount = 0;
  let rowCount = 0;

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
    if (!data?.alerts) continue;

    const rows = parseAlerts(data);
    if (!rows.length) continue;

    const loggedAtMs = obj.logged_at ? Date.parse(obj.logged_at) : Date.now();
    upsertAlerts(rows, Number.isFinite(loggedAtMs) ? loggedAtMs : Date.now());
    alertMessageCount++;
    rowCount += rows.length;
  }

  console.log(JSON.stringify({ lineCount, alertMessageCount, rowCount }));
}

main();
