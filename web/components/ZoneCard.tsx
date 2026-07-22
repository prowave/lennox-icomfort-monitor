"use client";

import { useState } from "react";
import type { ZoneConfigDbRow, ZoneReadingRow } from "@/lib/types";
import { zoneOperationDisplay } from "@/lib/zoneOperationIcons";

function fmt(value: number | null, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ZoneCard({
  zone,
  color,
  config,
}: {
  zone: ZoneReadingRow;
  color: string;
  config?: ZoneConfigDbRow;
}) {
  const operation = zoneOperationDisplay(zone.temp_operation);
  const [editing, setEditing] = useState(false);
  const [hspInput, setHspInput] = useState("");
  const [cspInput, setCspInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setHspInput(zone.hsp !== null ? String(zone.hsp) : "");
    setCspInput(zone.csp !== null ? String(zone.csp) : "");
    setSaveState("idle");
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const hsp = Number(hspInput);
    const csp = Number(cspInput);
    if (!Number.isFinite(hsp) || !Number.isFinite(csp)) {
      setSaveState("error");
      setError("Enter valid numbers");
      return;
    }
    setSaveState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/zones/${zone.zone_id}/setpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hsp, csp }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveState("error");
        setError(json.error ?? "Failed to save");
        return;
      }
      setSaveState("saved");
      setTimeout(() => setEditing(false), 1500);
    } catch {
      setSaveState("error");
      setError("Failed to reach the app");
    }
  };

  const boundsHint =
    config && (config.min_hsp !== null || config.max_hsp !== null || config.min_csp !== null || config.max_csp !== null)
      ? `Heat ${fmt(config.min_hsp)}-${fmt(config.max_hsp)}, Cool ${fmt(config.min_csp)}-${fmt(config.max_csp)}`
      : null;

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full mr-2"
            style={{ background: color }}
          />
          Zone {zone.zone_id}
        </span>
        <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <span aria-hidden className={operation.animated ? "zone-op-pulse" : undefined}>
            {operation.emoji}
          </span>
          {operation.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {fmt(zone.temperature, "°F")}
        </span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          humidity {fmt(zone.humidity, "%")}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        <dt>Mode</dt>
        <dd>{zone.system_mode ?? "—"}</dd>
        <dt>Fan</dt>
        <dd>{zone.fan_mode ?? "—"}</dd>
        <dt>Setpoint</dt>
        <dd>{fmt(zone.sp, "°F")}</dd>
        <dt>Heat / Cool SP</dt>
        <dd>
          {!editing ? (
            <button
              className="underline decoration-dotted"
              onClick={startEditing}
              style={{ color: "var(--text-secondary)" }}
            >
              {fmt(zone.hsp, "°")} / {fmt(zone.csp, "°")}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1">
              <input
                type="number"
                value={hspInput}
                onChange={(e) => setHspInput(e.target.value)}
                className="w-14 px-1 rounded text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
              />
              /
              <input
                type="number"
                value={cspInput}
                onChange={(e) => setCspInput(e.target.value)}
                className="w-14 px-1 rounded text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
              />
            </span>
          )}
        </dd>
      </dl>

      {editing && (
        <div className="flex flex-col gap-1 mt-1">
          {boundsHint && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {boundsHint}
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              className="text-xs px-3 py-1 rounded-full"
              style={{ background: "var(--series-1)", color: "var(--surface-1)" }}
              onClick={save}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Saving…" : "Save"}
            </button>
            <button
              className="text-xs px-3 py-1 rounded-full"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={cancelEditing}
              disabled={saveState === "saving"}
            >
              Cancel
            </button>
            {saveState === "saved" && (
              <span className="text-xs" style={{ color: "var(--status-good)" }}>
                Saved
              </span>
            )}
          </div>
          {error && (
            <span className="text-xs" style={{ color: "var(--status-critical)" }}>
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
