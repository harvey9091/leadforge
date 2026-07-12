/**
 * GET /api/v1/optimization/health — comprehensive system health
 */
import { db } from "@/lib/db";
import { getMetricsDashboard } from "@/server/optimization/system-metrics";
import { getCrawlStats } from "@/server/optimization/incremental-crawl";
import { getAllSourceMetrics, calculateCompositeScore } from "@/server/optimization/source-metrics";
import { getFeedbackStats } from "@/server/optimization/feedback-loop";
import { getPromptStats } from "@/server/optimization/prompt-versioning";
import { getCircuitBreakerStatus, getLLMConfig } from "@/server/ai/freellm-client";
import { getWorkerStatus } from "@/server/discovery/worker/worker";
import { getEnrichmentWorkerStatus } from "@/server/enrichment/worker/worker";
import { getAIWorkerStatus } from "@/server/ai/worker/worker";
import { checkFirecrawlHealth } from "@/server/enrichment/firecrawl-client";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  const [metrics, crawlStats, sourceMetrics, feedbackStats, promptStats, firecrawlHealth] = await Promise.all([
    getMetricsDashboard(),
    getCrawlStats(),
    getAllSourceMetrics(),
    getFeedbackStats(),
    getPromptStats(),
    checkFirecrawlHealth(),
  ]);

  return apiSuccess({
    version: "6.0.0-phase6",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    metrics,
    crawlStats,
    sourceMetrics: sourceMetrics.map((m) => ({
      sourceType: m.sourceType,
      priority: m.priority,
      compositeScore: calculateCompositeScore(m),
      reliability: m.reliabilityScore,
      companiesDiscovered: m.companiesDiscovered,
      companiesRetained: m.companiesRetained,
      avgQualification: m.avgQualificationScore,
      avgConfidence: m.avgConfidence,
      avgIcpMatch: m.avgIcpMatch,
    })),
    feedback: feedbackStats,
    promptStats: {
      totalAnalyses: promptStats.totalAnalyses,
      totalTokens: promptStats.totalTokens,
      totalCost: promptStats.totalCost,
      versionCount: promptStats.versions.length,
    },
    workers: {
      discovery: getWorkerStatus(),
      enrichment: getEnrichmentWorkerStatus(),
      ai: getAIWorkerStatus(),
    },
    circuitBreaker: getCircuitBreakerStatus(),
    llmConfig: {
      model: getLLMConfig().model,
      temperature: getLLMConfig().temperature,
      maxTokens: getLLMConfig().maxTokens,
    },
    firecrawl: {
      available: firecrawlHealth.available,
      latencyMs: firecrawlHealth.latencyMs,
    },
    database: {
      connected: true,
    },
  }, { requestId: ctx.requestId });
}
