import { NextResponse } from "next/server";
import { getEquipmentSnapshot, getLatestSystemReading, getLatestZoneSnapshot, getAllZoneConfigs } from "@/lib/db";
import { getPollerStatus } from "@/lib/poller";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    zones: getLatestZoneSnapshot(),
    zoneConfig: getAllZoneConfigs(),
    system: getLatestSystemReading(),
    equipment: getEquipmentSnapshot(),
    poller: getPollerStatus(),
  });
}
