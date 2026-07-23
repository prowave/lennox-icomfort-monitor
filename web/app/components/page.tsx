"use client";

import { useCallback, useEffect, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { colorForZone } from "@/lib/palette";
import { ZoneCard } from "@/components/ZoneCard";
import { EquipmentCard } from "@/components/EquipmentCard";
import type { ComponentsResponse, EquipmentDiagnosticDbRow, EquipmentFeatureDbRow } from "@/lib/types";

type RefreshState = "idle" | "requesting" | "requested" | "error";

export default function ComponentsPage() {
  const [data, setData] = useState<ComponentsResponse | null>(null);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");

  const refetch = useCallback(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const requestDiagnostics = useCallback(() => {
    setRefreshState("requesting");
    fetch("/api/equipment/refresh", { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error("request failed");
        setRefreshState("requested");
        setTimeout(() => setRefreshState("idle"), 3000);
      })
      .catch(() => {
        setRefreshState("error");
        setTimeout(() => setRefreshState("idle"), 3000);
      });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useLennoxEvent((event) => {
    if (event.type === "zones" || event.type === "system" || event.type === "equipment") {
      refetch();
    }
  });

  const byEquipmentId: Record<number, EquipmentFeatureDbRow[]> = {};
  for (const feature of data?.equipment ?? []) {
    (byEquipmentId[feature.equipment_id] ??= []).push(feature);
  }
  const equipmentByIdEntries = Object.entries(byEquipmentId);

  const diagnosticsByEquipmentId: Record<number, EquipmentDiagnosticDbRow[]> = {};
  for (const diagnostic of data?.diagnostics ?? []) {
    (diagnosticsByEquipmentId[diagnostic.equipment_id] ??= []).push(diagnostic);
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm uppercase" style={{ color: "var(--text-muted)" }}>
            Equipment
          </h2>
          <button
            className="text-xs px-3 py-1 rounded-full card"
            style={{ color: "var(--text-secondary)" }}
            onClick={requestDiagnostics}
            disabled={refreshState === "requesting"}
          >
            {refreshState === "requesting"
              ? "Requesting…"
              : refreshState === "requested"
                ? "Requested ✓"
                : refreshState === "error"
                  ? "Failed - try again"
                  : "Get Diagnostic Data"}
          </button>
        </div>
        <p className="text-xs mb-3 -mt-2" style={{ color: "var(--text-muted)" }}>
          Asks the S30 to re-report equipment diagnostics now. Fields still reading &quot;waiting...&quot; mean the
          outdoor unit hasn&apos;t sent a live value recently - not a failed request.
        </p>
        {equipmentByIdEntries.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Waiting for equipment data…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipmentByIdEntries.map(([equipmentId, features]) => (
              <EquipmentCard
                key={equipmentId}
                equipmentId={Number(equipmentId)}
                features={features}
                diagnostics={diagnosticsByEquipmentId[Number(equipmentId)]}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Zones
        </h2>
        {(data?.zones ?? []).length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Waiting for zone data…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.zones ?? []).map((zone) => (
              <ZoneCard
                key={zone.zone_id}
                zone={zone}
                color={colorForZone(zone.zone_id)}
                config={data?.zoneConfig.find((c) => c.zone_id === zone.zone_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
