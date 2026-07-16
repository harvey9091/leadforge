/**
 * POST /api/v1/integrations/[id]/models
 * Discover available models for a specific integration (e.g. FreeLLM).
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiSuccess, apiError, getRequestContext } from "@/server/utils/api";
import { AppError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = getRequestContext(req);
  try {
    const id = params.id;
    if (!id) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Integration ID is required", status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const models = await integrationManager.discoverModels(id, body);

    return apiSuccess({
      success: models.length > 0,
      models: models.map((m) => m.id),
      latencyMs: undefined,
      error: models.length === 0 ? "No models returned from API" : undefined,
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err);
  }
}
