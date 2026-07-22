"use client";

import { useCallback, useEffect, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { firstValue } from "@/lib/equipmentFeatures";
import type { EquipmentFeatureDbRow } from "@/lib/types";

const FALLBACK_LABEL = "Lennox HVAC System";

export function HeaderTitle() {
  const [label, setLabel] = useState(FALLBACK_LABEL);

  const refetch = useCallback(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then((json) => {
        const features: EquipmentFeatureDbRow[] = json.equipment ?? [];
        // equipment_id 0 is the System / Subnet Controller - its "Product Type"
        // is the model reported by the connected device itself (S30, S40, ...).
        const productType = features.find(
          (f) => f.equipment_id === 0 && f.feature_name === "Product Type"
        );
        if (productType) {
          setLabel(`Lennox ${firstValue(productType.values_json)}`);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useLennoxEvent((event) => {
    if (event.type === "equipment") refetch();
  });

  return (
    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
      {label}
    </span>
  );
}
