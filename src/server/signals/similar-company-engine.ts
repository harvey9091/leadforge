/**
 * =============================================================================
 * Similar Company Engine — Phase 7
 * =============================================================================
 *
 * Finds similar companies using:
 *  - Industry matching
 *  - Technology overlap
 *  - Target customer similarity
 *  - Pricing model similarity
 *  - ICP match proximity
 * =============================================================================
 */

import { db } from "@/lib/db";

export interface SimilarityFactors {
  industry: number;
  technologies: number;
  targetCustomer: number;
  pricingModel: number;
  icpMatch: number;
  overall: number;
}

export interface SimilarCompany {
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  companyLogo: string | null;
  industry: string | null;
  score: number;
  factors: SimilarityFactors;
}

/**
 * Find similar companies for a given company.
 */
export async function findSimilarCompanies(companyId: string, limit: number = 10): Promise<SimilarCompany[]> {
  const source = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true, name: true, industry: true, pricingModel: true,
      companyTechnologies: { include: { technology: { select: { name: true } } } },
      aiAnalyses: {
        where: { status: "completed" },
        take: 1,
        orderBy: { analyzedAt: "desc" },
        select: { targetCustomer: true, icpMatchPct: true },
      },
    },
  });

  if (!source) return [];

  const sourceTechs = new Set(source.companyTechnologies.map((ct) => ct.technology.name));
  const sourceTargetCustomer = source.aiAnalyses[0]?.targetCustomer ?? null;
  const sourceIcp = source.aiAnalyses[0]?.icpMatchPct ?? null;

  // Get all other companies with AI analysis
  const candidates = await db.company.findMany({
    where: { id: { not: companyId } },
    take: 1000, // cap for performance
    select: {
      id: true, name: true, domain: true, logoUrl: true, industry: true, pricingModel: true,
      companyTechnologies: { include: { technology: { select: { name: true } } } },
      aiAnalyses: {
        where: { status: "completed" },
        take: 1,
        orderBy: { analyzedAt: "desc" },
        select: { targetCustomer: true, icpMatchPct: true },
      },
    },
  });

  const results: SimilarCompany[] = [];

  for (const candidate of candidates) {
    const factors: SimilarityFactors = {
      industry: 0,
      technologies: 0,
      targetCustomer: 0,
      pricingModel: 0,
      icpMatch: 0,
      overall: 0,
    };

    // Industry match
    if (source.industry && candidate.industry) {
      factors.industry = source.industry.toLowerCase() === candidate.industry.toLowerCase() ? 100 : 0;
    }

    // Technology overlap (Jaccard similarity)
    const candidateTechs = new Set(candidate.companyTechnologies.map((ct) => ct.technology.name));
    const intersection = new Set([...sourceTechs].filter((t) => candidateTechs.has(t)));
    const union = new Set([...sourceTechs, ...candidateTechs]);
    factors.technologies = union.size > 0 ? (intersection.size / union.size) * 100 : 0;

    // Target customer match
    const candidateTargetCustomer = candidate.aiAnalyses[0]?.targetCustomer ?? null;
    if (sourceTargetCustomer && candidateTargetCustomer) {
      factors.targetCustomer = sourceTargetCustomer === candidateTargetCustomer ? 100 : 0;
    }

    // Pricing model match
    if (source.pricingModel && candidate.pricingModel) {
      factors.pricingModel = source.pricingModel === candidate.pricingModel ? 100 : 0;
    }

    // ICP match proximity
    const candidateIcp = candidate.aiAnalyses[0]?.icpMatchPct ?? null;
    if (sourceIcp !== null && candidateIcp !== null) {
      factors.icpMatch = 100 - Math.abs(sourceIcp - candidateIcp);
    }

    // Overall score (weighted)
    factors.overall = Math.round(
      factors.industry * 0.25 +
      factors.technologies * 0.30 +
      factors.targetCustomer * 0.15 +
      factors.pricingModel * 0.10 +
      factors.icpMatch * 0.20
    );

    if (factors.overall > 20) { // only include if some similarity
      results.push({
        companyId: candidate.id,
        companyName: candidate.name,
        companyDomain: candidate.domain,
        companyLogo: candidate.logoUrl,
        industry: candidate.industry,
        score: factors.overall,
        factors,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  // Cache top results
  const topResults = results.slice(0, limit);
  await cacheSimilarityResults(companyId, topResults);

  return topResults;
}

/**
 * Cache similarity results in the database.
 */
async function cacheSimilarityResults(companyId: string, results: SimilarCompany[]): Promise<void> {
  // Clear old cached results
  await db.similarityResult.deleteMany({ where: { companyId } });

  // Store new results
  for (const result of results) {
    await db.similarityResult.create({
      data: {
        companyId,
        similarCompanyId: result.companyId,
        score: result.score,
        factors: JSON.stringify(result.factors),
      },
    }).catch(() => {
      // Ignore errors (e.g., if similarCompanyId doesn't exist)
    });
  }
}

/**
 * Get cached similarity results.
 */
export async function getCachedSimilarCompanies(companyId: string, limit: number = 10) {
  const results = await db.similarityResult.findMany({
    where: { companyId },
    orderBy: { score: "desc" },
    take: limit,
    include: {
      similarCompany: {
        select: { id: true, name: true, domain: true, logoUrl: true, industry: true },
      },
    },
  });

  return results.map((r) => ({
    companyId: r.similarCompany.id,
    companyName: r.similarCompany.name,
    companyDomain: r.similarCompany.domain,
    companyLogo: r.similarCompany.logoUrl,
    industry: r.similarCompany.industry,
    score: r.score,
    factors: JSON.parse(r.factors) as SimilarityFactors,
  }));
}
