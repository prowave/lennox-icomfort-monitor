import type { NetworkInterfaceDbRow } from "@/lib/types";

/** Typical WiFi signal-strength bands, in dBm - more negative is weaker. */
function signalLabel(rssi: number | null): string {
  if (rssi === null) return "Unknown";
  if (rssi >= -50) return "Excellent";
  if (rssi >= -60) return "Good";
  if (rssi >= -70) return "Fair";
  return "Weak";
}

function signalColor(rssi: number | null): string {
  if (rssi === null) return "var(--text-muted)";
  if (rssi >= -60) return "var(--status-good)";
  if (rssi >= -70) return "var(--status-warning)";
  return "var(--status-critical)";
}

function formatBitRate(bitRate: number | null): string | null {
  if (bitRate === null) return null;
  return `${(bitRate / 1_000_000).toFixed(0)} Mbps`;
}

export function NetworkCard({ iface }: { iface: NetworkInterfaceDbRow | undefined }) {
  const rssi = iface?.rssi ?? null;
  const speed = formatBitRate(iface?.bit_rate ?? null);

  return (
    <div className="card p-4">
      <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
        Network
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {iface ? `${rssi ?? "—"} dBm` : "—"}
        </span>
        <span className="text-sm" style={{ color: signalColor(rssi) }}>
          {iface ? signalLabel(rssi) : ""}
        </span>
      </div>
      <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
        {iface?.ssid ?? "—"} {speed ? `· ${speed}` : ""}
      </div>
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {iface?.ip ?? "—"}
        {iface?.channel !== null && iface?.channel !== undefined ? ` · Ch ${iface.channel}` : ""}
      </div>
    </div>
  );
}
