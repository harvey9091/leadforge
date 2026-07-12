/**
 * POST /api/v1/enrich/jobs/:id/retry
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
    if (job.status !== "FAILED" && job.status !== "COMPLETED" && job.status !== "CANCELLED") {
      return apiError(new Error(`Cannot retry job in ${job.status} status`), ctx.requestId);
    }
    await enrichmentJobRepository.update(id, {
      status: "QUEUED",
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      pagesCrawled: 0,
      technologiesFound: 0,
    });
    notifyNewEnrichmentJob();
    return apiSuccess({ ok: true, status: "QUEUED" }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
