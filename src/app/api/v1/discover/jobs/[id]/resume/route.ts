/**
 * POST /api/v1/discover/jobs/:id/resume
 * Resume a paused discovery job. Sets status back to QUEUED so the worker
 * picks it up on the next poll.
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

    if (job.status !== "PAUSED") {
      return apiError(new Error(`Cannot resume job in ${job.status} status`), ctx.requestId);
    }

    await discoveryJobRepository.setStatus(id, "QUEUED", { pausedAt: null });
    notifyNewJob();
    return apiSuccess({ ok: true, status: "QUEUED" }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
