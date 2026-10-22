import { NextResponse } from "next/server";

import { getLiveAvailability } from "@/lib/live-availability";

/**
 * Whether Live exploration / comparison can run on this server. Booleans and fixed reasons only; no secrets, no probing.
 * Reading the request URL makes this handler dynamic (evaluated per request, like /api/qloo/status), so the
 * environment is never frozen at build time. `export const dynamic` is not allowed with Cache Components.
 */
export async function GET(request: Request) {
  new URL(request.url);
  return NextResponse.json(getLiveAvailability(), { headers: { "Cache-Control": "no-store" } });
}
