/**
 * =============================================================================
 * Smart Priority Engine — Phase 7
 * =============================================================================
 *
 * Replaces the static qualification score with a dynamic, evolving score.
 * Inputs: discovery quality, enrichment quality, AI confidence, website changes,
 * hiring velocity, funding, technology maturity, pricing maturity, signal freshness,
 * historical trend.
 * =============================================================================
 */

import { db } from "@/lib/db";

export interface PriorityFactors {
  discoveryQuality: number;
  enrichmentQuality: number;
  aiConfidence: number;
  websiteChanges: number;
  hiringVelocity: number;
  funding: number;
  techMaturity: number;
  pricingMaturity: number;
  signalFreshness: number;
  historicalTrend: number;
}

export interface PriorityResult {
  score: number;
  factors: PriorityFactors;
  explanation: Array<{ factor: string; contribution: number; detail: string }>;
  trend: "rising" | "stable" | "declining";
}

const WEIGHTS: PriorityFactors = {
  discoveryQuality: 0.10,
  enrichmentQuality: 0.10,
  aiConfidence: 0.15,
  websiteChanges: 0.10,
  hiringVelocity: 0.12,
  funding: 0.10,
  techMaturity: 0.08,
  pricingMaturity: 0.08,
  signalFreshness: 0.10,
  historicalTrend: 0.07,
};

/**
 * Calculate the dynamic priority score for a company.
 */
export async function calculatePriority(companyId: string): Promise<PriorityResult> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      name: true, domain: true, lastEnrichedAt: true, enrichmentPages: true,
      pricingDetected: true, enterpriseDetected: true, fundingStage: true,
      sources: { select: { type: true, firstSeenAt: true } },
      signals: { select: { signalType: true, importance: true, detectedAt: true }, take: 20, orderBy: { detectedAt: "desc" } },
      aiAnalyses: {
        where: { status: "completed" },
        take: 2,
        orderBy: { analyzedAt: "desc" },
        select: { overallConfidence: true, qualificationScore: true, icpMatchPct: true, hiringTrend: true, hiringStatus: true, productMaturity: true, pricingModel: true, videoOverall: true, websiteOverall: true, analyzedAt: true },
      },
      companyTechnologies: { select: { technology: { select: { name: true } } } },
      historicalSnapshots: { orderBy: { capturedAt: "desc" }, take: 5, select: { contentHash: true, capturedAt: true } },
    },
  });

  if (!company) {
    return {
      score: 0,
      factors: { discoveryQuality: 0, enrichmentQuality: 0, aiConfidence: 0, websiteChanges: 0, hiringVelocity: 0, funding: 0, techMaturity: 0, pricingMaturity: 0, signalFreshness: 0, historicalTrend: 0 },
      explanation: [],
      trend: "stable",
    };
  }

  const ai = company.aiAnalyses[0];
  const prevAi = company.aiAnalyses[1];

  const factors: PriorityFactors = {
    discoveryQuality: 50,
    enrichmentQuality: company.lastEnrichedAt ? Math.min(100, (company.enrichmentPages ?? 0) * 20) : 0,
    aiConfidence: ai?.overallConfidence ?? 0,
    websiteChanges: 50,
    hiringVelocity: 50,
    funding: 50,
    techMaturity: 50,
    pricingMaturity: 50,
    signalFreshness: 50,
    historicalTrend: 50,
  };

  const explanation: Array<{ factor: string; contribution: number; detail: string }> = [];

  // Discovery quality — based on number of sources
  const sourceCount = company.sources.length;
  factors.discoveryQuality = Math.min(100, sourceCount * 25 + 25);
  explanation.push({
    factor: "Discovery Quality",
    contribution: factors.discoveryQuality * WEIGHTS.discoveryQuality,
    detail: `${sourceCount} source(s) discovered this company`,
  });

  // Enrichment quality
  if (company.lastEnrichedAt) {
    factors.enrichmentQuality = Math.min(100, (company.enrichmentPages ?? 0) * 20);
    explanation.push({
      factor: "Enrichment Quality",
      contribution: factors.enrichmentQuality * WEIGHTS.enrichmentQuality,
      detail: `${company.enrichmentPages ?? 0} pages crawled`,
    });
  }

  // AI confidence
  if (ai) {
    factors.aiConfidence = ai.overallConfidence ?? 50;
    explanation.push({
      factor: "AI Confidence",
      contribution: factors.aiConfidence * WEIGHTS.aiConfidence,
      detail: `AI confidence: ${ai.overallConfidence}%, qualification: ${ai.qualificationScore}`,
    });
  }

  // Website changes — based on number of historical snapshots with different hashes
  const uniqueHashes = new Set(company.historicalSnapshots.map((s) => s.contentHash));
  factors.websiteChanges = Math.min(100, uniqueHashes.size * 25);
  explanation.push({
    factor: "Website Activity",
    contribution: factors.websiteChanges * WEIGHTS.websiteChanges,
    detail: `${uniqueHashes.size} version(s) detected in history`,
  });

  // Hiring velocity
  if (ai?.hiringTrend === "Growing") {
    factors.hiringVelocity = 80;
    explanation.push({ factor: "Hiring Velocity", contribution: 80 * WEIGHTS.hiringVelocity, detail: "AI detected growing hiring trend" });
  } else if (ai?.hiringTrend === "Stable") {
    factors.hiringVelocity = 50;
  } else if (ai?.hiringTrend === "Shrinking") {
    factors.hiringVelocity = 20;
  }

  // Funding
  const fundingMap: Record<string, number> = { Seed: 70, "Series A": 85, "Series B+": 95, Pre_seed: 50, Bootstrapped: 40, Public: 90, Acquired: 60 };
  factors.funding = fundingMap[company.fundingStage ?? ""] ?? 50;
  explanation.push({ factor: "Funding Stage", contribution: factors.funding * WEIGHTS.funding, detail: `Stage: ${company.fundingStage ?? "unknown"}` });

  // Technology maturity
  const techCount = company.companyTechnologies.length;
  factors.techMaturity = Math.min(100, techCount * 10);
  explanation.push({ factor: "Technology Maturity", contribution: factors.techMaturity * WEIGHTS.techMaturity, detail: `${techCount} technologies detected` });

  // Pricing maturity
  if (company.enterpriseDetected) {
    factors.pricingMaturity = 90;
    explanation.push({ factor: "Pricing Maturity", contribution: 90 * WEIGHTS.pricingMaturity, detail: "Enterprise pricing detected" });
  } else if (company.pricingDetected) {
    factors.pricingMaturity = 70;
    explanation.push({ factor: "Pricing Maturity", contribution: 70 * WEIGHTS.pricingMaturity, detail: "Pricing page detected" });
  }

  // Signal freshness — how recent are the latest signals?
  const recentSignals = company.signals.filter((s) => {
    const daysAgo = (Date.now() - s.detectedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7;
  });
  factors.signalFreshness = Math.min(100, recentSignals.length * 20 + (company.signals.length > 0 ? 30 : 0));
  explanation.push({ factor: "Signal Freshness", contribution: factors.signalFreshness * WEIGHTS.signalFreshness, detail: `${recentSignals.length} recent signal(s) (last 7 days)` });

  // Historical trend — compare current vs previous AI qualification
  if (ai && prevAi) {
    const currentQual = ai.qualificationScore ?? 50;
    const prevQual = prevAi.qualificationScore ?? 50;
    if (currentQual > prevQual + 5) {
      factors.historicalTrend = 80;
    } else if (currentQual < prevQual - 5) {
      factors.historicalTrend = 30;
    } else {
      factors.historicalTrend = 50;
    }
    explanation.push({ factor: "Historical Trend", contribution: factors.historicalTrend * WEIGHTS.historicalTrend, detail: `Qualification: ${prevQual} → ${currentQual}` });
  }

  // Calculate weighted score
  const score = Math.round(
    factors.discoveryQuality * WEIGHTS.discoveryQuality +
    factors.enrichmentQuality * WEIGHTS.enrichmentQuality +
    factors.aiConfidence * WEIGHTS.aiConfidence +
    factors.websiteChanges * WEIGHTS.websiteChanges +
    factors.hiringVelocity * WEIGHTS.hiringVelocity +
    factors.funding * WEIGHTS.funding +
    factors.techMaturity * WEIGHTS.techMaturity +
    factors.pricingMaturity * WEIGHTS.pricingMaturity +
    factors.signalFreshness * WEIGHTS.signalFreshness +
    factors.historicalTrend * WEIGHTS.historicalTrend
  );

  // Determine trend
  let trend: "rising" | "stable" | "declining" = "stable";
  if (ai && prevAi) {
    const diff = (ai.qualificationScore ?? 50) - (prevAi.qualificationScore ?? 50);
    if (diff > 5) trend = "rising";
    else if (diff < -5) trend = "declining";
  }

  return { score, factors, explanation, trend };
}
