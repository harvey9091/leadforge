/**
 * GET /api/v1/discover/stats
 * Discovery dashboard metrics — real data from the database.
 */

import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalCompanies,
      companiesToday,
      jobsToday,
      runningJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
      pausedJobs,
      totalJobs,
      sourceDistribution,
      recentDiscoveries,
    ] = await Promise.all([
      db.company.count(),
      db.company.count({ where: { discoveredAt: { gte: todayStart } } }),
      db.discoveryJob.count({ where: { createdAt: { gte: todayStart } } }),
      db.discoveryJob.count({ where: { status: "RUNNING" } }),
      db.discoveryJob.count({ where: { status: "COMPLETED" } }),
      db.discoveryJob.count({ where: { status: "FAILED" } }),
      db.discoveryJob.count({ where: { status: "QUEUED" } }),
      db.discoveryJob.count({ where: { status: "PAUSED" } }),
      db.discoveryJob.count(),
      db.source.groupBy({ by: ["type"], _count: true }),
      db.company.findMany({
        take: 8,
        orderBy: { discoveredAt: "desc" },
        select: {
          id: true, name: true, domain: true, description: true,
          country: true, industry: true, discoveredAt: true,
          sources: { select: { type: true }, take: 1 },
        },
      }),
    ]);

    // Compute average runtime from completed jobs
    const completedWithTimes = await db.discoveryJob.findMany({
      where: { status: "COMPLETED", startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      take: 50,
    });
    const runtimes = completedWithTimes
      .map((j) => (j.completedAt?.getTime() ?? 0) - (j.startedAt?.getTime() ?? 0))
      .filter((r) => r > 0);
    const avgRuntimeMs = runtimes.length > 0
      ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length
      : 0;

    return apiSuccess(
      {
        companies: {
          total: totalCompanies,
          today: companiesToday,
        },
        jobs: {
          total: totalJobs,
          today: jobsToday,
          running: runningJobs,
          completed: completedJobs,
          failed: failedJobs,
          queued: queuedJobs,
          paused: pausedJobs,
        },
        avgRuntimeMs,
        sourceDistribution: sourceDistribution.map((s) => ({
          source: s.type,
          count: s._count,
        })),
        recentDiscoveries: recentDiscoveries.map((c) => ({
          id: c.id,
          name: c.name,
          domain: c.domain,
          description: c.description,
          country: c.country,
          industry: c.industry,
          discoveredAt: c.discoveredAt,
          source: c.sources[0]?.type ?? null,
        })),
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
