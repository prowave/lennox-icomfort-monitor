"use client";

import { useLennoxStreamStatus } from "@/lib/useLennoxStream";

export function StatusPill() {
  const { connected, stale } = useLennoxStreamStatus();

  let label = "Connecting…";
  let color = "var(--text-muted)";
  if (connected && !stale) {
    label = "Live";
    color = "var(--status-good)";
  } else if (stale) {
    label = "Stale";
    color = "var(--status-warning)";
  } else if (!connected) {
    label = "Disconnected";
    color = "var(--status-critical)";
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
