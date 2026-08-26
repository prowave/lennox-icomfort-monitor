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

/** Number of filled signal bars (out of 4) for a given RSSI. */
function signalBars(rssi: number | null): number {
  if (rssi === null) return 0;
  if (rssi >= -50) return 4;
  if (rssi >= -60) return 3;
  if (rssi >= -70) return 2;
  return 1;
}

function formatBitRate(bitRate: number | null): string | null {
  if (bitRate === null) return null;
  return `${(bitRate / 1_000_000).toFixed(0)} Mbps`;
}

function SignalBars({ rssi }: { rssi: number | null }) {
  const filled = signalBars(rssi);
  const color = signalColor(rssi);
  const heights = [8, 14, 20, 26];

  return (
    <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 9}
          y={26 - h}
          width={6}
          height={h}
          rx={1}
          fill={i < filled ? color : "var(--gridline)"}
        />
      ))}
    </svg>
  );
}

export function NetworkCard({ iface }: { iface: NetworkInterfaceDbRow | undefined }) {
  const rssi = iface?.rssi ?? null;
  const speed = formatBitRate(iface?.bit_rate ?? null);

  return (
    <div className="card p-4">
      <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
        Network
      </div>
      <div className="flex items-center gap-2 mt-1">
        <SignalBars rssi={rssi} />
        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: signalColor(rssi) }}>
            {iface ? signalLabel(rssi) : "—"}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {iface ? `${rssi ?? "—"} dBm` : ""}
          </span>
        </div>
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
