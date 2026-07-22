"use client";

import { Fragment, useEffect, useState } from "react";
import type { EquipmentFeatureDbRow } from "@/lib/types";
import { firstValue } from "@/lib/equipmentFeatures";

const IDENTITY_FEATURES = [
  "Equipment Type Name",
  "Product Type",
  "Unit Model Number",
  "Control Model Number",
  "Unit Serial Number",
  "Control Serial Number",
  "Control Software Revision",
  "Control Hardware Revision",
  "Number of Heating Stages",
  "Number of Cooling Stages",
];

export function EquipmentCard({
  equipmentId,
  features,
}: {
  equipmentId: number;
  features: EquipmentFeatureDbRow[];
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  const byName = new Map(features.map((f) => [f.feature_name, f]));
  const typeName = byName.get("Equipment Type Name");
  const title = typeName ? firstValue(typeName.values_json) : `Equipment ${equipmentId}`;
  const lastSeen = features.reduce((max, f) => Math.max(max, f.last_seen_ts), 0);
  const healthy = now !== null && lastSeen > 0 && now - lastSeen < 10 * 60 * 1000;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            color: healthy ? "var(--status-good)" : "var(--status-warning)",
            background: "var(--surface-1)",
            border: `1px solid ${healthy ? "var(--status-good)" : "var(--status-warning)"}`,
          }}
        >
          {healthy ? "reporting" : "no recent data"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        {IDENTITY_FEATURES.filter((name) => byName.has(name) && name !== "Equipment Type Name").map((name) => (
          <Fragment key={name}>
            <dt>{name}</dt>
            <dd>{firstValue(byName.get(name)!.values_json)}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
