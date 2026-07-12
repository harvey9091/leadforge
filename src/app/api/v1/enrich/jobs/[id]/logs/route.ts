/**
 * GET /api/v1/enrich/jobs/:id/logs
 */

import { enrichmentLogRepository } from "@/server/repositories/enrichment.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") ?? "100", 10));
    const logs = await enrichmentLogRepository.listByJob(id, limit);
    return apiSuccess({ data: logs }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
