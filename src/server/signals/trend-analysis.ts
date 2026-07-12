/**
 * =============================================================================
 * Trend Analysis — Phase 7
 * =============================================================================
 *
 * Calculates aggregate trends across all companies:
 *  - Fastest-growing industries
 *  - Most appearing technologies
 *  - Most common pricing models
 *  - Most active hiring categories
 *  - Highest confidence sectors
 *  - Most valuable discovery source
 * =============================================================================
 */

import { db } from "@/lib/db";

export interface TrendResult {
  name: string;
  currentValue: number;
  previousValue: number;
  changePct: number;
  trend: "rising" | "stable" | "declining";
}

export interface TrendAnalysis {
  industries: TrendResult[];
  technologies: TrendResult[];
  pricingModels: TrendResult[];
  fundingStages: TrendResult[];
  hiringTrends: TrendResult[];
  highestConfidenceSectors: Array<{ name: string; avgConfidence: number; count: number }>;
  mostValuableSource: Array<{ name: string; avgQualification: number; count: number }>;
}

/**
 * Calculate trends across all companies.
 */
export async function calculateTrends(): Promise<TrendAnalysis> {
  // Get all companies with AI analysis for the current period (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [currentCompanies, previousCompanies, allTechs, allAiAnalyses, allSources] = await Promise.all([
    db.company.findMany({
      where: { discoveredAt: { gte: thirtyDaysAgo } },
      select: { industry: true, pricingModel: true, fundingStage: true },
      take: 10000,
    }),
    db.company.findMany({
      where: { discoveredAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      select: { industry: true, pricingModel: true, fundingStage: true },
      take: 10000,
    }),
    db.companyTechnology.findMany({
      take: 10000,
      include: { technology: { select: { name: true } } },
    }),
    db.aIAnalysis.findMany({
      where: { status: "completed" },
      select: { overallConfidence: true, hiringTrend: true, company: { select: { industry: true, sources: { select: { type: true } } } } },
      take: 10000,
    }),
    db.source.findMany({
      take: 10000,
      include: { company: { include: { aiAnalyses: { where: { status: "completed" }, select: { qualificationScore: true }, take: 1, orderBy: { analyzedAt: "desc" } } } } },
    }),
  ]);

  // Industry trends
  const currentIndustries = countBy(currentCompanies.map((c) => c.industry).filter(Boolean) as string[]);
  const previousIndustries = countBy(previousCompanies.map((c) => c.industry).filter(Boolean) as string[]);
  const industries = calculateTrendResults(currentIndustries, previousIndustries).sort((a, b) => b.changePct - a.changePct);

  // Technology trends
  const techCounts = countBy(allTechs.map((t) => t.technology.name));
  const technologies = Object.entries(techCounts)
    .map(([name, count]) => ({ name, currentValue: count, previousValue: 0, changePct: count > 0 ? 100 : 0, trend: "rising" as const }))
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 15);

  // Pricing model trends
  const currentPricing = countBy(currentCompanies.map((c) => c.pricingModel).filter(Boolean) as string[]);
  const previousPricing = countBy(previousCompanies.map((c) => c.pricingModel).filter(Boolean) as string[]);
  const pricingModels = calculateTrendResults(currentPricing, previousPricing).sort((a, b) => b.currentValue - a.currentValue);

  // Funding stage trends
  const currentFunding = countBy(currentCompanies.map((c) => c.fundingStage).filter(Boolean) as string[]);
  const previousFunding = countBy(previousCompanies.map((c) => c.fundingStage).filter(Boolean) as string[]);
  const fundingStages = calculateTrendResults(currentFunding, previousFunding).sort((a, b) => b.currentValue - a.currentValue);

  // Hiring trends
  const hiringCounts = countBy(allAiAnalyses.map((a) => a.hiringTrend).filter(Boolean) as string[]);
  const hiringTrends = Object.entries(hiringCounts).map(([name, count]) => ({
    name, currentValue: count, previousValue: 0, changePct: 0, trend: "stable" as const,
  }));

  // Highest confidence sectors
  const confidenceByIndustry = new Map<string, { sum: number; count: number }>();
  for (const a of allAiAnalyses) {
    const industry = a.company.industry;
    if (!industry || a.overallConfidence === null) continue;
    const existing = confidenceByIndustry.get(industry) ?? { sum: 0, count: 0 };
    confidenceByIndustry.set(industry, { sum: existing.sum + a.overallConfidence, count: existing.count + 1 });
  }
  const highestConfidenceSectors = Array.from(confidenceByIndustry.entries())
    .map(([name, { sum, count }]) => ({ name, avgConfidence: sum / count, count }))
    .sort((a, b) => b.avgConfidence - a.avgConfidence)
    .slice(0, 10);

  // Most valuable source
  const sourceQualification = new Map<string, { sum: number; count: number }>();
  for (const s of allSources) {
    const qualification = s.company.aiAnalyses[0]?.qualificationScore;
    if (qualification === null || qualification === undefined) continue;
    const existing = sourceQualification.get(s.type) ?? { sum: 0, count: 0 };
    sourceQualification.set(s.type, { sum: existing.sum + qualification, count: existing.count + 1 });
  }
  const mostValuableSource = Array.from(sourceQualification.entries())
    .map(([name, { sum, count }]) => ({ name, avgQualification: sum / count, count }))
    .sort((a, b) => b.avgQualification - a.avgQualification);

  return {
    industries: industries.slice(0, 10),
    technologies,
    pricingModels,
    fundingStages,
    hiringTrends,
    highestConfidenceSectors,
    mostValuableSource,
  };
}

function countBy(arr: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of arr) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return map;
}

function calculateTrendResults(current: Map<string, number>, previous: Map<string, number>): TrendResult[] {
  const allKeys = new Set([...current.keys(), ...previous.keys()]);
  const results: TrendResult[] = [];

  for (const key of allKeys) {
    const curr = current.get(key) ?? 0;
    const prev = previous.get(key) ?? 0;
    const changePct = prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
    const trend: "rising" | "stable" | "declining" = changePct > 10 ? "rising" : changePct < -10 ? "declining" : "stable";
    results.push({ name: key, currentValue: curr, previousValue: prev, changePct: Math.round(changePct), trend });
  }

  return results;
}
