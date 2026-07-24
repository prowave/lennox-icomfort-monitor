# Future work: enabling live equipment diagnostics (diagLevel)

## Context

We built an equipment-diagnostics feature (Compressor Hz, Coil Temp, Discharge Air Temp,
Blower RPM, pressure switches, etc.) and then removed it, because in practice every
numeric field just sat at the device's own `"waiting..."` placeholder and never
populated with a real value - the feature added UI noise with no payoff.

While investigating why, we found the likely reason in the raw device log
(`lennox_log.jsonl`): every equipment status block carries

```json
"diagControl": {"level": 0, "writeAccess": "remote"}
```

and `diagLevel` has been **exactly 0 in every single message ever logged** on this
system - it has never once changed. This strongly suggests it's a diagnostic-mode
toggle that gates whether the outdoor/indoor units actively report the fine-grained
telemetry at all, and it's marked remotely writable.

## What we don't have confirmed independently

The user provided a summary of what this field supposedly does, sourced from the
open-source `lennoxs30` Home Assistant integration's documentation. **This app has not
independently verified that source this session** - treat the claims below as a
starting hypothesis to confirm, not as ground truth to implement against directly.
Claimed behavior, as relayed:

- `diagLevel` is a telemetry-verbosity switch, not a control/test override. Setting it
  to **2** causes the S30 to report inverter power draw and the full diagnostic sensor
  set. **0 or 2 only - other values (including 1) are documented as invalid.**
- It does NOT force an equipment test cycle - that's a separate, distinct "Tests" list
  (e.g. "Blower", "HP Heat - Minimum Rate") requiring a deliberate, separate command.
- Real documented risk: enabling full diagnostics while the system is *also* connected
  to the Lennox cloud (mobile app in use) can reportedly cause S30 stability problems,
  because the extra data volume can overwhelm it across both channels at once.
  "Inverter Power can only be enabled for Local Connections" - which is what this app
  already uses exclusively, so that's reportedly the safer variant.
- Not persistent - a power cycle/reboot of the controller is claimed to reset
  `diagLevel` back to 0 automatically.
- Toggling it rapidly/frequently is not recommended; there's a claimed quirk where
  adjusting fan CFM while diagnostics are enabled can freeze some diagnostic fields
  (said to be cosmetic, fixed by toggling 0 -> 2 again).

**Before implementing anything below**: find and read the actual `lennoxs30`
integration source/docs directly (not secondhand) to confirm this, since we're talking
about writing to a live, real HVAC controller. Do not skip this step on the assumption
the summary above is accurate.

## Proposed implementation (once verified)

1. Reinstate the equipment-diagnostics ingestion pipeline we just removed:
   `parseEquipmentDiagnostics` in `lib/parse.ts`, the `equipment_diagnostics` table and
   `upsertEquipmentDiagnostics`/`getEquipmentDiagnosticsSnapshot` in `lib/db.ts`, and the
   `if (data.equipments)` wiring in `lib/poller.ts` - all still visible in git history
   (commit `dea8866`) if reverting is easier than rewriting.
2. Add a write path mirroring the existing setpoint-write infrastructure
   (`lib/zoneControl.ts` / `app/api/zones/[zoneId]/setpoint/route.ts`):
   - A new function (e.g. `lib/diagnosticsControl.ts`) building the write payload.
     **The exact JSON shape is an unverified guess** based on the read-side structure
     (`equipments[].equipment.diagControl`) - most likely something like
     `{"equipments":[{"id": <equipmentId>, "equipment":{"diagControl":{"level": 2}}}]}`,
     sent via `LennoxClient.publish()` (`lib/lennoxClient.ts`) the same way setpoint
     writes work. Confirm this shape against the reference source before sending it.
   - A new route, e.g. `app/api/equipment/[equipmentId]/diagnostics-level/route.ts`
     (`POST { level: 0 | 2 }`), rejecting any other value per the "0 or 2 only" claim.
3. UI: a clearly-labeled toggle (not a silent auto-enable) on the Components page -
   "Enable full diagnostics (temporary)" - with the network-instability caveat shown
   in the UI itself, and a manual "Turn off" control. Consider an auto-revert-to-0
   after a bounded window (e.g. 10 minutes) as a safety net, since we can't be certain
   it always self-resets outside of an actual power cycle.
4. Testing protocol: only test over the local connection (already the only mode this
   app uses), close/avoid the Lennox mobile app during the test window, watch the
   Components page for a few minutes to see whether real values populate, then
   explicitly set the level back to 0.

## Before doing any of this

- Verify the claimed field semantics against the actual `lennoxs30` integration
  source, not the secondhand summary above.
- Get the user's explicit go-ahead before sending the first real write - this changes
  live behavior on a physical HVAC controller, same bar as the setpoint-write feature.
