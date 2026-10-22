import { NextResponse } from "next/server";

import { getLiveAvailability } from "@/lib/live-availability";

// Environment is read per request: never cached at build time, never CDN-cached.
export const dynamic = "force-dynamic";

/** Whether Live exploration / comparison can run on this server. Booleans and fixed reasons only; no secrets, no probing. */
export async function GET() {
  return NextResponse.json(getLiveAvailability(), { headers: { "Cache-Control": "no-store" } });
}
