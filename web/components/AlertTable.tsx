"use client";

import { Fragment, useState } from "react";
import type { AlertDbRow } from "@/lib/types";
import { priorityColor, fmtTimestamp, equipmentLabel, messageLabel } from "@/lib/alertLabels";

function boolLabel(v: number): string {
  return v ? "yes" : "no";
}

function AlertDetail({ alert }: { alert: AlertDbRow }) {
  const [showRaw, setShowRaw] = useState(false);
  let prettyRaw = alert.raw_json ?? "";
  try {
    prettyRaw = JSON.stringify(JSON.parse(alert.raw_json ?? "{}"), null, 2);
  } catch {
    // leave as-is
  }

  return (
    <tr>
      <td colSpan={6} className="px-3 pb-4" style={{ background: "var(--surface-1)" }}>
        <dl
          className="grid gap-x-4 gap-y-2 text-sm py-3"
          style={{ gridTemplateColumns: "180px 1fr", color: "var(--text-secondary)" }}
        >
          <dt style={{ color: "var(--text-muted)" }}>Equipment</dt>
          <dd>{equipmentLabel(alert)}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Alert code</dt>
          <dd>{alert.code}</dd>

          <dt style={{ color: "var(--text-muted)" }}>User message ID</dt>
          <dd>{alert.user_message_id ?? "—"}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Cleared at</dt>
          <dd>{fmtTimestamp(alert.timestamp_clear)}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Action</dt>
          <dd>{alert.action ?? "—"}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Cleared by</dt>
          <dd>{alert.cleared_by ?? "—"}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Update flag</dt>
          <dd>{boolLabel(alert.update_flag)}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Occurrence count</dt>
          <dd>{alert.count ?? "—"}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Notify user / dealer</dt>
          <dd>
            {boolLabel(alert.notify_user)} / {boolLabel(alert.notify_dealer)}
          </dd>

          <dt style={{ color: "var(--text-muted)" }}>Clearable by user / dealer</dt>
          <dd>
            {boolLabel(alert.clearable_by_user)} / {boolLabel(alert.clearable_by_dealer)}
          </dd>

          <dt style={{ color: "var(--text-muted)" }}>Last updated</dt>
          <dd>{new Date(alert.updated_at).toLocaleString()}</dd>
        </dl>

        <button
          className="text-xs underline"
          style={{ color: "var(--text-muted)" }}
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? "Hide raw JSON" : "Show raw JSON"}
        </button>
        {showRaw && (
          <pre
            className="mt-2 p-3 rounded text-xs overflow-x-auto"
            style={{ background: "var(--background)", color: "var(--text-secondary)" }}
          >
            {prettyRaw}
          </pre>
        )}
      </td>
    </tr>
  );
}

export function AlertTable({ alerts, emptyLabel }: { alerts: AlertDbRow[]; emptyLabel: string }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!alerts.length) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-sm text-left" style={{ color: "var(--text-secondary)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Message</th>
            <th className="px-3 py-2 font-medium">Equipment</th>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">First seen</th>
            <th className="px-3 py-2 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => {
            const key = `${a.code}-${a.equipment_type}-${a.identity_ts}`;
            const expanded = expandedKey === key;
            return (
              <Fragment key={key}>
                <tr
                  onClick={() => setExpandedKey(expanded ? null : key)}
                  className="cursor-pointer"
                  style={{ borderBottom: expanded ? "none" : "1px solid var(--gridline)" }}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: priorityColor(a.priority) }}
                      />
                      {a.priority ?? "unknown"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{messageLabel(a)}</td>
                  <td className="px-3 py-2">{equipmentLabel(a)}</td>
                  <td className="px-3 py-2">{a.code}</td>
                  <td className="px-3 py-2">{fmtTimestamp(a.timestamp_first)}</td>
                  <td className="px-3 py-2">{fmtTimestamp(a.timestamp_last)}</td>
                </tr>
                {expanded && <AlertDetail alert={a} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
