"use client";

import { useId, useMemo, useState } from "react";
import type { ZoneConfigDbRow, ZoneReadingRow } from "@/lib/types";
import { zoneOperationDisplay } from "@/lib/zoneOperationIcons";
import { titleCase } from "@/lib/formatLabel";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

function fmt(value: number | null, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface SnowFlake {
  left: number;
  size: number;
  duration: number;
  delay: number;
}

const SNOW_FLAKE_COUNT = 14;

function generateSnowFlakes(): SnowFlake[] {
  return Array.from({ length: SNOW_FLAKE_COUNT }, () => {
    const duration = 6 + Math.random() * 6;
    return {
      left: Math.random() * 100,
      size: 9 + Math.random() * 8,
      duration,
      // Negative delay starts each flake already mid-fall, so they look
      // scattered immediately on mount instead of all beginning at the top together.
      delay: -Math.random() * duration,
    };
  });
}

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
  const isCooling = zone.temp_operation === "cooling";
  const isHeating = zone.temp_operation === "heating";
  const snowFlakes = useMemo(() => generateSnowFlakes(), []);
  const prefersReducedMotion = usePrefersReducedMotion();
  const shimmerId = `heat-shimmer-${useId().replace(/:/g, "")}`;
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
    <div className="card p-4 flex flex-col gap-2 relative overflow-hidden">
      {isCooling && !prefersReducedMotion && (
        <div className="absolute inset-0" style={{ zIndex: 0, pointerEvents: "none" }} aria-hidden>
          {snowFlakes.map((flake, i) => (
            <span
              key={i}
              className="snow-flake"
              style={{
                left: `${flake.left}%`,
                fontSize: flake.size,
                animationDuration: `${flake.duration}s`,
                animationDelay: `${flake.delay}s`,
              }}
            >
              ❄️
            </span>
          ))}
        </div>
      )}
      {isHeating && !prefersReducedMotion && (
        <div className="absolute inset-0" style={{ zIndex: 0, pointerEvents: "none" }} aria-hidden>
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <filter id={shimmerId}>
              <feTurbulence type="fractalNoise" numOctaves={2} baseFrequency="0.01 0.06" seed={3} result="turbulence">
                <animate
                  attributeName="baseFrequency"
                  dur="8s"
                  values="0.01 0.06;0.02 0.10;0.01 0.06"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="turbulence" scale={14} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <div className="heat-shimmer-glow" style={{ filter: `url(#${shimmerId})` }} />
        </div>
      )}
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
        <dd>{titleCase(zone.system_mode)}</dd>
        <dt>Fan</dt>
        <dd>{titleCase(zone.fan_mode)}</dd>
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
