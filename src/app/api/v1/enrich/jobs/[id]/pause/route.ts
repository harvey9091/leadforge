/**
 * POST /api/v1/enrich/jobs/:id/pause
 */

import { enrichmentJobRepository } from "@/server/repositories/enrichment.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const job = await enrichmentJobRepository.findById(id);
    if (!job) return apiError(new Error("Job not found"), ctx.requestId);
    if (job.status !== "RUNNING" && job.status !== "QUEUED") {
      return apiError(new Error(`Cannot pause job in ${job.status} status`), ctx.requestId);
    }
    await enrichmentJobRepository.setStatus(id, "PAUSED");
    return apiSuccess({ ok: true, status: "PAUSED" }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
