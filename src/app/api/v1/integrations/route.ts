/**
 * GET /api/v1/integrations
 * List all integrations with their current status.
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  const integrations = integrationManager.getAll();
  const health = await integrationManager.checkAllHealth();

  const result = integrations.map((integration) => {
    const h = health.get(integration.id);
    return {
      id: integration.id,
      name: integration.name,
      description: integration.description,
      capabilities: integration.capabilities,
      status: h?.status ?? "unknown",
      latencyMs: h?.latencyMs,
      version: h?.version,
      error: h?.error,
      lastChecked: h?.lastChecked,
      lastSuccessAt: h?.lastSuccessAt,
    };
  });

  return apiSuccess({ integrations: result }, { requestId: ctx.requestId });
}
