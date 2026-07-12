/**
 * POST /api/v1/discover/jobs/:id/retry
 * Retry a failed or completed discovery job. Resets progress and re-queues.
 */

import { discoveryJobRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { notifyNewJob } from "@/server/discovery/worker/worker";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const job = await discoveryJobRepository.findById(id);
    if (!job) return apiError(new Error("Job not found"), ctx.requestId);

    if (job.status !== "FAILED" && job.status !== "COMPLETED" && job.status !== "CANCELLED") {
      return apiError(new Error(`Cannot retry job in ${job.status} status`), ctx.requestId);
    }

    // Reset progress and re-queue
    await discoveryJobRepository.update(id, {
      status: "QUEUED",
      companiesFound: 0,
      companiesStored: 0,
      duplicatesFound: 0,
      errorsCount: 0,
      retriesCount: (job.retriesCount ?? 0) + 1,
      currentSource: null,
      currentPage: 0,
      totalPages: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      estimatedCompletion: null,
    });

    notifyNewJob();
    return apiSuccess({ ok: true, status: "QUEUED" }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
