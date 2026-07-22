import { NextResponse } from "next/server";
import { LennoxClient } from "@/lib/lennoxClient";
import { buildSetpointPayload } from "@/lib/zoneControl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SetpointBody {
  hsp?: number;
  csp?: number;
}

export async function POST(request: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId: zoneIdParam } = await params;
  const zoneId = Number(zoneIdParam);
  if (!Number.isFinite(zoneId)) {
    return NextResponse.json({ error: "Invalid zoneId" }, { status: 400 });
  }

  let body: SetpointBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = buildSetpointPayload({ zoneId, hsp: body.hsp, csp: body.csp });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const ip = process.env.LENNOX_IP;
  if (!ip) {
    return NextResponse.json({ error: "LENNOX_IP is not configured" }, { status: 500 });
  }
  const appId = process.env.LENNOX_APP_ID ?? "nextjs_dashboard";

  try {
    const client = new LennoxClient(ip, appId);
    await client.connect();
    await client.publish(result.payload);
  } catch (e) {
    return NextResponse.json({ error: `Failed to write to device: ${(e as Error).message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
