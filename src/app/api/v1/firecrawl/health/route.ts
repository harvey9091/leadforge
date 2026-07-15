/**
 * GET /api/v1/firecrawl/health
 * Check Firecrawl instance health.
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  const health = await integrationManager.checkHealth("firecrawl", true);

  return apiSuccess({
    configured: health.status !== "disconnected" && health.status !== "error",
    available: health.status === "connected",
    latencyMs: health.latencyMs,
    version: health.version,
    error: health.error,
    mode: health.status === "connected" ? "firecrawl" : "direct",
  }, { requestId: ctx.requestId });
}
