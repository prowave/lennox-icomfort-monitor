"use client";

import { useCallback, useEffect, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { AlertTable } from "@/components/AlertTable";
import type { AlertsResponse } from "@/lib/types";

const SEVERITIES = ["critical", "serious", "moderate", "info"] as const;

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | "all">("all");

  const refetch = useCallback(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useLennoxEvent((event) => {
    if (event.type === "alerts") refetch();
  });

  const history = alerts?.history ?? [];
  const filteredHistory =
    severityFilter === "all" ? history : history.filter((a) => a.priority === severityFilter);

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Active
        </h2>
        <AlertTable alerts={alerts?.active ?? []} emptyLabel="No active alerts." />
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm uppercase" style={{ color: "var(--text-muted)" }}>
            History
          </h2>
          <div className="flex items-center gap-2">
            {(["all", ...SEVERITIES] as const).map((severity) => (
              <button
                key={severity}
                className="text-xs px-3 py-1 rounded-full card capitalize"
                style={{
                  color: severityFilter === severity ? "var(--surface-1)" : "var(--text-secondary)",
                  background: severityFilter === severity ? "var(--series-1)" : "var(--surface-1)",
                }}
                onClick={() => setSeverityFilter(severity)}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>
        <AlertTable
          alerts={filteredHistory}
          emptyLabel={severityFilter === "all" ? "No cleared alerts yet." : `No ${severityFilter} alerts.`}
          showDuration
        />
      </div>
    </div>
  );
}
