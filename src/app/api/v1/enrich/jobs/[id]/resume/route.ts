/**
 * POST /api/v1/enrich/jobs/:id/resume
 */

import { enrichmentJobRepository } from "@/server/repositories/enrichment.repository";
import { notifyNewEnrichmentJob } from "@/server/enrichment/worker/worker";
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
    if (job.status !== "PAUSED") {
      return apiError(new Error(`Cannot resume job in ${job.status} status`), ctx.requestId);
    }
    await enrichmentJobRepository.setStatus(id, "QUEUED");
    notifyNewEnrichmentJob();
    return apiSuccess({ ok: true, status: "QUEUED" }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
