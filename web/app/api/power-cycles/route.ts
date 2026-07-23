import { NextResponse } from "next/server";
import { getPowerCycleEvents } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = Date.now();
  const from = Number(searchParams.get("from") ?? now - DAY_MS);
  const to = Number(searchParams.get("to") ?? now);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return NextResponse.json({ error: "from/to must be epoch milliseconds" }, { status: 400 });
  }

  return NextResponse.json({ events: getPowerCycleEvents(from, to) });
}
