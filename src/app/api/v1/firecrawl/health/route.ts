/**
 * GET /api/v1/firecrawl/health
 * Check Firecrawl instance health.
 */

import { checkFirecrawlHealth, isFirecrawlConfigured } from "@/server/enrichment/firecrawl-client";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  const configured = isFirecrawlConfigured();
  const health = await checkFirecrawlHealth();

  return apiSuccess({
    configured,
    available: health.available,
    latencyMs: health.latencyMs,
    version: health.version,
    error: health.error,
    mode: health.available ? "firecrawl" : "direct",
  }, { requestId: ctx.requestId });
}
