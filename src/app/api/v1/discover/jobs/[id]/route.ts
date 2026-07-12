/**
 * GET /api/v1/discover/jobs/:id
 * Get a single discovery job with details.
 *
 * POST /api/v1/discover/jobs/:id — update (pause/resume/retry/cancel)
 */

import { discoveryJobRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { notifyNewJob } from "@/server/discovery/worker/worker";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const job = await discoveryJobRepository.findById(id);
    if (!job) {
      return apiError(new Error("Job not found"), ctx.requestId);
    }
    return apiSuccess({ job: serializeJob(job) }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

function serializeJob(job: Record<string, unknown>) {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    sources: safeJsonArray(job.sources as string),
    maxCompanies: job.maxCompanies,
    keywords: safeJsonArray(job.keywords as string),
    categories: safeJsonArray(job.categories as string),
    regions: safeJsonArray(job.regions as string),
    fundingStages: safeJsonArray(job.fundingStages as string),
    hiringOnly: job.hiringOnly,
    dateFrom: job.dateFrom,
    dateTo: job.dateTo,
    companiesFound: job.companiesFound,
    companiesStored: job.companiesStored,
    duplicatesFound: job.duplicatesFound,
    errorsCount: job.errorsCount,
    retriesCount: job.retriesCount,
    currentSource: job.currentSource,
    currentPage: job.currentPage,
    totalPages: job.totalPages,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    pausedAt: job.pausedAt,
    cancelledAt: job.cancelledAt,
    lastHeartbeat: job.lastHeartbeat,
    estimatedCompletion: job.estimatedCompletion,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    _count: (job as { _count?: { logs: number; jobSources: number } })._count,
  };
}

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
