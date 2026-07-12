/**
 * GET /api/v1/enrich/jobs/:id
 * Get a single enrichment job.
 */

import { enrichmentJobRepository } from "@/server/repositories/enrichment.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const job = await enrichmentJobRepository.findById(id);
    if (!job) return apiError(new Error("Job not found"), ctx.requestId);
    return apiSuccess({ job }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
