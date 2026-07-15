/**
 * POST /api/v1/integrations/[id]/test
 * Test connection to a specific integration.
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
    const result = await integrationManager.testConnection(id, body);

    return apiSuccess(result, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err);
  }
}
