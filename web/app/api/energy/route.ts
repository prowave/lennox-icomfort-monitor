import { NextResponse } from "next/server";
import { computeDailyCoolingMinutes, estimateCost } from "@/lib/energyEstimate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAYS_TO_RETURN = 14;
const ZONE_ID = 0; // this system has a single zone sharing one compressor

function localDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const wattsRunning = Number(process.env.AC_RUNNING_WATTS ?? 4000);
  const ratePerKwh = Number(process.env.ELECTRICITY_RATE_PER_KWH ?? 0.14);

  const allDays = computeDailyCoolingMinutes(ZONE_ID);
  const days = allDays.slice(-DAYS_TO_RETURN).map((d) => ({
    date: d.date,
    coolingMinutes: d.coolingMinutes,
    estimatedCost: estimateCost(d.coolingMinutes, wattsRunning, ratePerKwh),
  }));

  const todayKey = localDateKey(Date.now());
  const today = days.find((d) => d.date === todayKey) ?? {
    date: todayKey,
    coolingMinutes: 0,
    estimatedCost: 0,
  };

  return NextResponse.json({ today, days, wattsRunning, ratePerKwh });
}
