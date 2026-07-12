/**
 * GET /api/v1/enrich/stats
 * Enrichment dashboard metrics.
 */

import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { checkFirecrawlHealth } from "@/server/enrichment/firecrawl-client";
import { getEnrichmentWorkerStatus } from "@/server/enrichment/worker/worker";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const [
      totalCompanies,
      enrichedCompanies,
      pendingEnrichment,
      runningJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
      totalJobs,
    ] = await Promise.all([
      db.company.count(),
      db.company.count({ where: { lastEnrichedAt: { not: null } } }),
      db.company.count({ where: { lastEnrichedAt: null } }),
      db.enrichmentJob.count({ where: { status: "RUNNING" } }),
      db.enrichmentJob.count({ where: { status: "COMPLETED" } }),
      db.enrichmentJob.count({ where: { status: "FAILED" } }),
      db.enrichmentJob.count({ where: { status: "QUEUED" } }),
      db.enrichmentJob.count(),
    ]);

    // Average crawl time + success rate
    const completedJobsData = await db.enrichmentJob.findMany({
      where: { status: "COMPLETED", durationMs: { not: null } },
      select: { durationMs: true, pagesCrawled: true },
      take: 50,
    });
    const avgCrawlMs = completedJobsData.length > 0
      ? completedJobsData.reduce((sum, j) => sum + (j.durationMs ?? 0), 0) / completedJobsData.length
      : 0;
    const avgPages = completedJobsData.length > 0
      ? completedJobsData.reduce((sum, j) => sum + (j.pagesCrawled ?? 0), 0) / completedJobsData.length
      : 0;
    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    // Firecrawl health
    const firecrawlHealth = await checkFirecrawlHealth();

    // Technology distribution — find all company technologies and count
    const allCompanyTechs = await db.companyTechnology.findMany({
      take: 500,
      select: { technologyId: true },
    });
    const techCounts = new Map<string, number>();
    for (const ct of allCompanyTechs) {
      techCounts.set(ct.technologyId, (techCounts.get(ct.technologyId) ?? 0) + 1);
    }
    const techIds = Array.from(techCounts.keys());
    const technologies = await db.technology.findMany({
      where: { id: { in: techIds } },
      select: { id: true, name: true, category: true },
    });
    const techMap = new Map(technologies.map((t) => [t.id, t]));
    const topTechnologies = Array.from(techCounts.entries())
      .map(([techId, count]) => ({
        name: techMap.get(techId)?.name ?? "Unknown",
        category: techMap.get(techId)?.category ?? "unknown",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent enrichments
    const recentEnrichments = await db.company.findMany({
      where: { lastEnrichedAt: { not: null } },
      orderBy: { lastEnrichedAt: "desc" },
      take: 8,
      select: {
        id: true, name: true, domain: true, logoUrl: true,
        lastEnrichedAt: true, enrichmentPages: true,
        pricingDetected: true, enterpriseDetected: true,
      },
    });

    return apiSuccess({
      companies: {
        total: totalCompanies,
        enriched: enrichedCompanies,
        pending: pendingEnrichment,
      },
      jobs: {
        total: totalJobs,
        running: runningJobs,
        completed: completedJobs,
        failed: failedJobs,
        queued: queuedJobs,
      },
      avgCrawlMs: Math.round(avgCrawlMs),
      avgPages: Math.round(avgPages * 10) / 10,
      successRate: Math.round(successRate * 10) / 10,
      firecrawl: {
        configured: firecrawlHealth.available,
        available: firecrawlHealth.available,
        latencyMs: firecrawlHealth.latencyMs,
        error: firecrawlHealth.error,
      },
      worker: getEnrichmentWorkerStatus(),
      topTechnologies,
      recentEnrichments,
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
