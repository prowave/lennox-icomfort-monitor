import { Leaf } from "lucide-react";

export function AwayModeCard({ isAway }: { isAway: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
        Away Mode
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Leaf aria-hidden size={28} style={{ color: isAway ? "var(--status-good)" : "var(--text-muted)" }} />
        <span
          className="text-2xl font-semibold"
          style={{ color: isAway ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {isAway ? "On" : "Off"}
        </span>
      </div>
    </div>
  );
}
