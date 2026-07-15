/**
 * GET /api/v1/integrations/health
 * Health check all integrations.
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const health = await integrationManager.checkAllHealth(true);
    const integrations = integrationManager.getAll();

    const result = integrations.map((integration) => {
      const h = health.get(integration.id);
      return {
        id: integration.id,
        name: integration.name,
        status: h?.status ?? "unknown",
        latencyMs: h?.latencyMs,
        version: h?.version,
        error: h?.error,
        lastChecked: h?.lastChecked,
        lastSuccessAt: h?.lastSuccessAt,
      };
    });

    return apiSuccess({ integrations: result, timestamp: new Date().toISOString() }, { requestId: ctx.requestId });
  } catch (err) {
    return apiSuccess(
      { integrations: [], error: err instanceof Error ? err.message : String(err) },
      { requestId: ctx.requestId }
    );
  }
}
