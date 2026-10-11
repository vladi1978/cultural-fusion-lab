import { NextResponse } from "next/server";

import { isQlooConfigured } from "@/lib/qloo/client";
import {
  getAuthProbeState,
  isLiveModeAllowed,
  isLiveOptInEnabled,
  verifyQlooAuthentication,
} from "@/lib/qloo/live-gate";

/**
 * Server status for Qloo Live Mode readiness.
 * Never returns the API key or any secret material.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const shouldProbe = url.searchParams.get("probe") === "1";

  let auth = getAuthProbeState();
  if (shouldProbe && isQlooConfigured()) {
    auth = await verifyQlooAuthentication();
  }

  return NextResponse.json({
    configured: isQlooConfigured(),
    liveOptIn: isLiveOptInEnabled(),
    liveAllowed: isLiveModeAllowed(),
    auth,
    baseUrlConfigured: Boolean(process.env.QLOO_BASE_URL?.trim()),
    defaultBaseUrl: "https://hackathon.api.qloo.com",
    note:
      "Live Mode stays disabled until a real QLOO_API_KEY authenticates and QLOO_LIVE_ENABLED=true. Demo Mode is unaffected.",
  });
}
