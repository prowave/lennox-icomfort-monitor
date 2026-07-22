import { NextResponse } from "next/server";
import { getAlertsForScatter } from "@/lib/db";
import { equipmentTypeName } from "@/lib/equipmentTypes";
import { alertCodeName } from "@/lib/alertCodes";
import type { AlertScatterPoint } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

interface AlertScatterRow {
  code: number;
  equipment_type: number;
  priority: string | null;
  user_message: string | null;
  timestamp_last: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = Date.now();
  const from = Number(searchParams.get("from") ?? now - DAY_MS);
  const to = Number(searchParams.get("to") ?? now);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return NextResponse.json({ error: "from/to must be epoch milliseconds" }, { status: 400 });
  }

  const rows = getAlertsForScatter(from, to) as AlertScatterRow[];

  const points: AlertScatterPoint[] = rows.map((r) => ({
    ts: Number(r.timestamp_last) * 1000,
    code: r.code,
    codeLabel: alertCodeName(r.code) ?? `Code ${r.code}`,
    equipmentType: r.equipment_type,
    equipmentLabel: equipmentTypeName(r.equipment_type) ?? `Type ${r.equipment_type}`,
    priority: r.priority,
    userMessage: r.user_message,
  }));

  return NextResponse.json({ points });
}
