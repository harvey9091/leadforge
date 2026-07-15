/**
 * GET /api/v1/ai/stats
 * AI dashboard metrics.
 */

import { aiAnalysisRepository } from "@/server/repositories/ai.repository";
import { getAIWorkerStatus } from "@/server/ai/worker/worker";
import { getCircuitBreakerStatus, getLLMConfig } from "@/server/ai/freellm-client";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const [stats, latest, totalCompanies, enrichedCompanies, llmConfig] = await Promise.all([
      aiAnalysisRepository.getStats(),
      aiAnalysisRepository.findLatest(8),
      db.company.count(),
      db.company.count({ where: { lastEnrichedAt: { not: null } } }),
      getLLMConfig(),
    ]);

    const pendingJobs = await db.aIJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } });
    const completedJobs = await db.aIJob.count({ where: { status: "COMPLETED" } });

    return apiSuccess({
      ...stats,
      totalCompanies,
      enrichedCompanies,
      pendingAnalysis: enrichedCompanies - stats.total,
      jobs: {
        pending: pendingJobs,
        completed: completedJobs,
      },
      worker: getAIWorkerStatus(),
      circuitBreaker: getCircuitBreakerStatus(),
      llmConfig: {
        model: llmConfig.model,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
      },
      latestAnalyses: latest.map((a) => ({
        companyId: a.companyId,
        companyName: (a.company as { name: string }).name,
        companyDomain: (a.company as { domain: string | null }).domain,
        companyLogo: (a.company as { logoUrl: string | null }).logoUrl,
        icpMatch: a.icpMatchPct,
        qualification: a.qualificationScore,
        videoOpportunity: a.videoOverall,
        confidence: a.overallConfidence,
        industry: a.industry,
        category: a.productCategory,
        analyzedAt: a.analyzedAt,
      })),
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
