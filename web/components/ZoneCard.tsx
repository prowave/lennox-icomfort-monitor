import type { ZoneReadingRow } from "@/lib/types";
import { zoneOperationDisplay } from "@/lib/zoneOperationIcons";

function fmt(value: number | null, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

export function ZoneCard({ zone, color }: { zone: ZoneReadingRow; color: string }) {
  const operation = zoneOperationDisplay(zone.temp_operation);
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
          {fmt(zone.hsp, "°")} / {fmt(zone.csp, "°")}
        </dd>
      </dl>
    </div>
  );
}
