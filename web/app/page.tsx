"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { colorForZone } from "@/lib/palette";
import { ZoneCard } from "@/components/ZoneCard";
import { WeatherWidget } from "@/components/WeatherWidget";
import { LoadGauge } from "@/components/LoadGauge";
import { FanCard } from "@/components/FanCard";
import { NetworkCard } from "@/components/NetworkCard";
import { AwayModeCard } from "@/components/AwayModeCard";
import { equipmentLabel, messageLabel } from "@/lib/alertLabels";
import { titleCase } from "@/lib/formatLabel";
import type { AlertsResponse, ComponentsResponse, EnergyResponse } from "@/lib/types";

export default function DashboardPage() {
  const [components, setComponents] = useState<ComponentsResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [energy, setEnergy] = useState<EnergyResponse | null>(null);

  const refetchComponents = useCallback(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then(setComponents)
      .catch(() => {});
  }, []);

  const refetchAlerts = useCallback(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {});
  }, []);

  const refetchEnergy = useCallback(() => {
    fetch("/api/energy")
      .then((r) => r.json())
      .then(setEnergy)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetchComponents();
    refetchAlerts();
    refetchEnergy();
  }, [refetchComponents, refetchAlerts, refetchEnergy]);

  useLennoxEvent((event) => {
    if (
      event.type === "zones" ||
      event.type === "system" ||
      event.type === "equipment" ||
      event.type === "network" ||
      event.type === "occupancy"
    ) {
      refetchComponents();
    }
    if (event.type === "alerts") {
      refetchAlerts();
    }
    if (event.type === "zones") {
      refetchEnergy();
    }
  });

  const activeAlerts = alerts?.active ?? [];
  const infoAlerts = alerts?.infoActive ?? [];
  const zones = components?.zones ?? [];
  const outdoor = components?.system;
  const equipmentCount = new Set((components?.equipment ?? []).map((f) => f.equipment_id)).size;
  const primaryZone = zones[0];
  const primaryInterface = components?.network[0];
  const isAway = components?.occupancy?.manual_away === 1;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {activeAlerts.length > 0 && (
        <Link
          href="/alerts"
          className="card p-4 flex items-center justify-between"
          style={{ borderColor: "var(--status-warning)" }}
        >
          <span style={{ color: "var(--text-primary)" }}>
            {activeAlerts.length} active alert{activeAlerts.length === 1 ? "" : "s"}
          </span>
          <span className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            View alerts
          </span>
        </Link>
      )}

      {infoAlerts.length > 0 && (
        <div className="card p-4">
          <div className="text-xs uppercase mb-2" style={{ color: "var(--text-muted)" }}>
            Info Notices
          </div>
          <div className="flex flex-col gap-2">
            {infoAlerts.map((a) => (
              <div
                key={`${a.code}-${a.equipment_type}-${a.identity_ts}`}
                className="flex items-center gap-2 text-sm"
              >
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--status-good)" }} />
                <span style={{ color: "var(--text-primary)" }}>{equipmentLabel(a)}</span>
                <span style={{ color: "var(--text-secondary)" }}>{messageLabel(a)}</span>
              </div>
            ))}
          </div>
          <Link href="/alerts" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            View alerts
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <WeatherWidget />
        <div className="card p-4">
          <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
            Outdoor Temperature
          </div>
          <div className="text-3xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
            {outdoor?.outdoor_temperature ?? "—"}°F
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {outdoor?.outdoor_temperature_status ? titleCase(outdoor.outdoor_temperature_status) : "Unknown"}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
            Equipment Components
          </div>
          <div className="text-3xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
            {equipmentCount}
          </div>
          <Link href="/components" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            View components
          </Link>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
            Today&apos;s AC Cost (est.)
          </div>
          <div className="text-3xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
            ${(energy?.today.estimatedCost ?? 0).toFixed(2)}
          </div>
          <Link href="/energy" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            View trend
          </Link>
        </div>
        <LoadGauge value={primaryZone?.demand ?? null} />
        <FanCard zone={primaryZone} />
        <NetworkCard iface={primaryInterface} />
        <AwayModeCard isAway={isAway} />
      </div>

      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Zones
        </h2>
        {zones.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Waiting for zone data…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map((zone) => (
              <ZoneCard
                key={zone.zone_id}
                zone={zone}
                color={colorForZone(zone.zone_id)}
                config={components?.zoneConfig.find((c) => c.zone_id === zone.zone_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
