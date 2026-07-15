/**
 * POST /api/v1/integrations/[id]/connect
 * Connect (reconnect) to a specific integration.
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiSuccess, apiError, getRequestContext } from "@/server/utils/api";
import { AppError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = getRequestContext(_req);
  try {
    const id = params.id;
    if (!id) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Integration ID is required", status: 400 });
    }

    const integration = integrationManager.get(id);
    if (!integration) {
      throw new AppError({ code: "NOT_FOUND", message: `Integration not found: ${id}`, status: 404 });
    }

    await integration.connect();
    const health = await integrationManager.checkHealth(id, true);

    return apiSuccess(
      {
        id,
        status: health.status,
        latencyMs: health.latencyMs,
        version: health.version,
        error: health.error,
        lastChecked: health.lastChecked,
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err);
  }
}
