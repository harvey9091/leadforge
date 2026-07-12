/**
 * POST /api/v1/discover/jobs/:id/pause
 * Pause a running discovery job. The worker checks status between each
 * company and stops gracefully.
 */

import { discoveryJobRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

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

    if (job.status !== "RUNNING" && job.status !== "QUEUED") {
      return apiError(new Error(`Cannot pause job in ${job.status} status`), ctx.requestId);
    }

    await discoveryJobRepository.setStatus(id, "PAUSED", { pausedAt: new Date() });
    return apiSuccess({ ok: true, status: "PAUSED" }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
