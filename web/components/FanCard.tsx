"use client";

import { Fan } from "lucide-react";
import type { ZoneReadingRow } from "@/lib/types";
import { titleCase } from "@/lib/formatLabel";

/**
 * The device's `fan` flag only tracks the periodic circulate-only duty cycle -
 * it reads 0 during an active heating/cooling call, even though the blower is
 * obviously running as part of that call. So "is the fan actually moving air"
 * has to account for the active call too, not just this one flag.
 */
function isFanRunning(zone: ZoneReadingRow | undefined): boolean {
  if (!zone) return false;
  return zone.temp_operation === "cooling" || zone.temp_operation === "heating" || zone.fan === 1;
}

function fanRunningReason(zone: ZoneReadingRow | undefined): string | null {
  if (zone?.temp_operation === "cooling") return "Cooling call";
  if (zone?.temp_operation === "heating") return "Heating call";
  if (zone?.fan === 1) return "Circulate cycle";
  return null;
}

export function FanCard({ zone }: { zone: ZoneReadingRow | undefined }) {
  const running = isFanRunning(zone);
  const reason = fanRunningReason(zone);

  return (
    <div className="card p-4">
      <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
        Fan
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Fan
          aria-hidden
          size={28}
          className={running ? "animate-spin" : undefined}
          style={{ color: running ? "var(--status-good)" : "var(--text-muted)", animationDuration: "1.6s" }}
        />
        <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {zone ? (running ? "Running" : "Idle") : "—"}
        </span>
      </div>
      {reason && (
        <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Driven by: {reason}
        </div>
      )}
      <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
        Mode: {titleCase(zone?.fan_mode)}
      </div>
      {zone?.damper !== null && zone?.damper !== undefined && (
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Damper: {Math.round(zone.damper)}%
        </div>
      )}
      <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        This device doesn&apos;t report blower RPM or speed - only on/off and mode.
      </div>
    </div>
  );
}
