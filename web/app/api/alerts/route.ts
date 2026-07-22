import { NextResponse } from "next/server";
import { getActiveAlerts, getAlertHistory, getActiveInfoAlerts } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    active: getActiveAlerts(),
    history: getAlertHistory(),
    infoActive: getActiveInfoAlerts(),
  });
}
