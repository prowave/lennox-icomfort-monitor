# Lennox iComfort Monitor

Monitors a Lennox S30/E30/S40 iComfort smart hub over its local HTTPS API,
logs everything, and serves a live dashboard: current status, active/historical
alerts, real-time and historical charts (temperature, humidity, alert
occurrences, estimated AC electricity cost), equipment inventory, and current
weather (sourced from the device's own feed).

## Layout

- **`web/`** - the Next.js app. This is what you actually run day-to-day: it
  polls the device itself (no separate script needed), logs to
  `lennox_log.jsonl` and a local SQLite database, and serves the dashboard.
- **`lennox_poll.py`** - the original standalone Python reference script the
  Next.js poller was built from. Talks to the same local API and logs to the
  same JSONL format. Kept for reference; not needed to run the app.

## How it talks to the device

The S30/E30/S40 exposes a local pub/sub HTTPS API (no cloud dependency):
`Connect` → subscribe via `RequestData` → long-poll `Retrieve`. The device
uses an old self-signed cert/cipher config, so both the Python script and the
Node client relax TLS verification/cipher selection to match what a browser
or `curl` would accept.

## Running the app

```bash
cd web
npm install
cp .env.local.example .env.local   # see below - not present until you create it
npm run build && npm run start     # or `npm run dev` for development
```

### Configuration (`web/.env.local`)

| Variable | Meaning |
|---|---|
| `LENNOX_IP` | LAN IP address of the S30/E30/S40 |
| `LENNOX_APP_ID` | Identifier this app registers under with the device (any unique string) |
| `LENNOX_LONG_POLL` | Long-poll timeout in seconds per retrieve cycle (default 10) |
| `AC_RUNNING_WATTS` | Assumed wattage while actively cooling, for the cost estimate - the device reports no real power metering |
| `ELECTRICITY_RATE_PER_KWH` | Your electricity rate, for the cost estimate |

This file is gitignored (along with the SQLite database in `web/data/`) since
it's local/machine-specific.

## Data

- `lennox_log.jsonl` - full-fidelity append-only log, one JSON object per
  message, written continuously. Gitignored (it's a large, ever-growing local
  data file, not source).
- `web/data/lennox.sqlite` - parsed/queryable subset the dashboard reads from
  (zone/system readings, alerts, equipment inventory, current weather).
  Rebuildable from `lennox_log.jsonl` at any time via `web/scripts/backfill-*.ts`.

## Notes

- The device broadcasts its own WiFi password in plaintext in its
  `interfaces` telemetry; the app redacts it before it's ever written to disk
  or sent to the browser.
- Alert history includes a self-healing reconciliation: on every reconnect,
  any alert the app thinks is still "active" that's absent from the device's
  fresh state snapshot gets automatically closed out, so a missed clear
  message (e.g. from a restart or network gap) doesn't leave a stale alert
  showing forever.
