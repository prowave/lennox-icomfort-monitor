"use client";

import { useCallback, useEffect, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { colorForZone } from "@/lib/palette";
import { ZoneCard } from "@/components/ZoneCard";
import { EquipmentCard } from "@/components/EquipmentCard";
import type { ComponentsResponse, EquipmentFeatureDbRow } from "@/lib/types";

export default function ComponentsPage() {
  const [data, setData] = useState<ComponentsResponse | null>(null);

  const refetch = useCallback(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
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

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Equipment
        </h2>
        {equipmentByIdEntries.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Waiting for equipment data…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipmentByIdEntries.map(([equipmentId, features]) => (
              <EquipmentCard key={equipmentId} equipmentId={Number(equipmentId)} features={features} />
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
              <ZoneCard key={zone.zone_id} zone={zone} color={colorForZone(zone.zone_id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
