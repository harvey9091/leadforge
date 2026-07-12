/**
 * GET /api/v1/stats/overview
 *
 * Aggregated KPI counts for the dashboard. Uses the new Phase 2 schema
 * with discovery job and company data.
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
      totalPeople,
      verifiedPeople,
      runningJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
    ] = await Promise.all([
      db.company.count(),
      db.company.count({ where: { discoveredAt: { gte: todayStart } } }),
      db.person.count(),
      db.person.count({ where: { verified: true } }),
      db.discoveryJob.count({ where: { status: "RUNNING" } }),
      db.discoveryJob.count({ where: { status: "COMPLETED" } }),
      db.discoveryJob.count({ where: { status: "FAILED" } }),
      db.discoveryJob.count({ where: { status: "QUEUED" } }),
    ]);

    // Source distribution
    const sourceCounts = await db.source.groupBy({
      by: ["type"],
      _count: true,
    });
    const sourceDistribution: Record<string, number> = {};
    for (const s of sourceCounts) {
      sourceDistribution[s.type] = s._count;
    }

    // Industry distribution
    const industryCounts = await db.company.groupBy({
      by: ["industry"],
      _count: true,
      where: { industry: { not: null } },
    });
    const industryDistribution: Record<string, number> = {};
    for (const i of industryCounts) {
      if (i.industry) industryDistribution[i.industry] = i._count;
    }

    // Country distribution
    const countryCounts = await db.company.groupBy({
      by: ["country"],
      _count: true,
      where: { country: { not: null } },
    });
    const countryDistribution: Record<string, number> = {};
    for (const c of countryCounts) {
      if (c.country) countryDistribution[c.country] = c._count;
    }

    return apiSuccess(
      {
        companies: {
          total: totalCompanies,
          today: companiesToday,
        },
        people: {
          total: totalPeople,
          verified: verifiedPeople,
        },
        jobs: {
          running: runningJobs,
          completed: completedJobs,
          failed: failedJobs,
          queued: queuedJobs,
        },
        distributions: {
          source: sourceDistribution,
          industry: industryDistribution,
          country: countryDistribution,
        },
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
