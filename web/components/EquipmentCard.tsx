"use client";

import { Fragment, useState } from "react";
import type { EquipmentDiagnosticDbRow, EquipmentFeatureDbRow } from "@/lib/types";
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

/** The S30's own placeholder for a diagnostic the outdoor unit hasn't reported a live value for yet. */
const PENDING_VALUE = "waiting...";

export function EquipmentCard({
  equipmentId,
  features,
  diagnostics = [],
}: {
  equipmentId: number;
  features: EquipmentFeatureDbRow[];
  diagnostics?: EquipmentDiagnosticDbRow[];
}) {
  const byName = new Map(features.map((f) => [f.feature_name, f]));
  const typeName = byName.get("Equipment Type Name");
  const title = typeName ? firstValue(typeName.values_json) : `Equipment ${equipmentId}`;
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
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
      {diagnostics.length > 0 && (
        <div className="pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
          <button
            className="text-xs uppercase underline decoration-dotted"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setShowDiagnostics((v) => !v)}
          >
            {showDiagnostics ? "Hide diagnostics" : `Show diagnostics (${diagnostics.length})`}
          </button>
          {showDiagnostics && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              {diagnostics.map((d) => {
                const pending = d.value === PENDING_VALUE || d.value === null || d.value === "";
                return (
                  <Fragment key={d.diagnostic_name}>
                    <dt>{d.diagnostic_name}</dt>
                    <dd style={pending ? { color: "var(--text-muted)", fontStyle: "italic" } : undefined}>
                      {pending ? "waiting…" : `${d.value}${d.unit ? ` ${d.unit}` : ""}`}
                    </dd>
                  </Fragment>
                );
              })}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
