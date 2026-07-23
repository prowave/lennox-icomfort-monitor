import { NextResponse } from "next/server";
import { getOutdoorTemperatureHistory, getZoneHistory, getZoneCoolingHistory } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") ?? "temperature";
  const zoneIdParam = searchParams.get("zoneId");
  const now = Date.now();
  const from = Number(searchParams.get("from") ?? now - DAY_MS);
  const to = Number(searchParams.get("to") ?? now);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return NextResponse.json({ error: "from/to must be epoch milliseconds" }, { status: 400 });
  }

  try {
    if (metric === "outdoor_temperature") {
      return NextResponse.json({ metric, points: getOutdoorTemperatureHistory(from, to) });
    }
    const zoneId = Number(zoneIdParam);
    if (zoneIdParam === null || !Number.isFinite(zoneId)) {
      return NextResponse.json({ error: "zoneId is required for zone metrics" }, { status: 400 });
    }
    if (metric === "cooling") {
      return NextResponse.json({ metric, zoneId, points: getZoneCoolingHistory(zoneId, from, to) });
    }
    return NextResponse.json({
      metric,
      zoneId,
      points: getZoneHistory(zoneId, metric, from, to),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
