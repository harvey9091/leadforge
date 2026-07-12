/**
 * GET /api/v1/workspace/analytics — intelligence-focused analytics
 */
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const [
      totalCompanies,
      enrichedCompanies,
      analyzedCompanies,
      allCompanies,
      allCompanyTechs,
      allAIAnalyses,
      sources,
    ] = await Promise.all([
      db.company.count(),
      db.company.count({ where: { lastEnrichedAt: { not: null } } }),
      db.aIAnalysis.count({ where: { status: "completed" } }),
      db.company.findMany({
        select: { industry: true, country: true, fundingStage: true, pricingModel: true },
        take: 10000,
      }),
      db.companyTechnology.findMany({
        take: 10000,
        include: { technology: { select: { name: true, category: true } } },
      }),
      db.aIAnalysis.findMany({
        where: { status: "completed" },
        select: { icpMatchPct: true, qualificationScore: true, overallConfidence: true, videoOverall: true },
        take: 10000,
      }),
      db.source.findMany({ select: { type: true }, take: 10000 }),
    ]);

    // Aggregate in JavaScript (avoids Prisma groupBy issues)
    const industries = new Map<string, number>();
    const countries = new Map<string, number>();
    const fundingStages = new Map<string, number>();
    const pricingModels = new Map<string, number>();

    for (const c of allCompanies) {
      if (c.industry) industries.set(c.industry, (industries.get(c.industry) ?? 0) + 1);
      if (c.country) countries.set(c.country, (countries.get(c.country) ?? 0) + 1);
      if (c.fundingStage) fundingStages.set(c.fundingStage, (fundingStages.get(c.fundingStage) ?? 0) + 1);
      if (c.pricingModel) pricingModels.set(c.pricingModel, (pricingModels.get(c.pricingModel) ?? 0) + 1);
    }

    // Technologies
    const technologies = new Map<string, { name: string; category: string; count: number }>();
    for (const ct of allCompanyTechs) {
      const key = ct.technology.name;
      const existing = technologies.get(key);
      if (existing) {
        existing.count++;
      } else {
        technologies.set(key, { name: ct.technology.name, category: ct.technology.category, count: 1 });
      }
    }

    // Sources
    const sourceMap = new Map<string, number>();
    for (const s of sources) {
      sourceMap.set(s.type, (sourceMap.get(s.type) ?? 0) + 1);
    }

    // AI distributions
    const icpBuckets = new Map<number, number>();
    const qualBuckets = new Map<number, number>();
    const videoBuckets = new Map<number, number>();
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const a of allAIAnalyses) {
      if (a.icpMatchPct !== null) icpBuckets.set(a.icpMatchPct, (icpBuckets.get(a.icpMatchPct) ?? 0) + 1);
      if (a.qualificationScore !== null) qualBuckets.set(a.qualificationScore, (qualBuckets.get(a.qualificationScore) ?? 0) + 1);
      if (a.videoOverall !== null) videoBuckets.set(a.videoOverall, (videoBuckets.get(a.videoOverall) ?? 0) + 1);
      if (a.overallConfidence !== null) {
        confidenceSum += a.overallConfidence;
        confidenceCount++;
      }
    }

    return apiSuccess({
      totalCompanies,
      enrichedCompanies,
      analyzedCompanies,
      industries: Array.from(industries.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count })),
      technologies: Array.from(technologies.values()).sort((a, b) => b.count - a.count).slice(0, 15),
      fundingStages: Array.from(fundingStages.entries()).filter((f) => f[0]).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      pricingModels: Array.from(pricingModels.entries()).filter((p) => p[0]).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      countries: Array.from(countries.entries()).filter((c) => c[0]).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count })),
      sources: Array.from(sourceMap.entries()).map(([name, count]) => ({ name, count })),
      icpDistribution: Array.from(icpBuckets.entries()).map(([score, count]) => ({ score, count })),
      qualificationDistribution: Array.from(qualBuckets.entries()).map(([score, count]) => ({ score, count })),
      avgConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
      videoOpportunityDistribution: Array.from(videoBuckets.entries()).map(([score, count]) => ({ score, count })),
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
