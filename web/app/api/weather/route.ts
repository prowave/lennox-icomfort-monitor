import { NextResponse } from "next/server";
import { getCurrentWeather } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ weather: getCurrentWeather() ?? null });
}
