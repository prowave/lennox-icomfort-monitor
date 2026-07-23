import { NextResponse } from "next/server";
import {
  getEquipmentSnapshot,
  getEquipmentDiagnosticsSnapshot,
  getLatestSystemReading,
  getLatestZoneSnapshot,
  getAllZoneConfigs,
} from "@/lib/db";
import { getPollerStatus } from "@/lib/poller";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    zones: getLatestZoneSnapshot(),
    zoneConfig: getAllZoneConfigs(),
    system: getLatestSystemReading(),
    equipment: getEquipmentSnapshot(),
    diagnostics: getEquipmentDiagnosticsSnapshot(),
    poller: getPollerStatus(),
  });
}
