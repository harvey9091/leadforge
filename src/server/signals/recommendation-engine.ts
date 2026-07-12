/**
 * =============================================================================
 * Recommendation Engine — Phase 7
 * =============================================================================
 *
 * Recommends actions for companies with explanations.
 * Recommendations: analyze, re-enrich, export, high_priority, needs_review,
 * low_confidence, watch
 * =============================================================================
 */

import { db } from "@/lib/db";
import { calculatePriority } from "./priority-engine";

export interface RecommendationData {
  companyId: string;
  action: string;
  reason: string;
  priority: number;
}

/**
 * Generate recommendations for a company.
 */
export async function generateRecommendations(companyId: string): Promise<RecommendationData[]> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      name: true, lastEnrichedAt: true, lastScreenshotAt: true,
      aiAnalyses: { where: { status: "completed" }, take: 1, orderBy: { analyzedAt: "desc" }, select: { overallConfidence: true, qualificationScore: true, icpMatchPct: true, analyzedAt: true } },
      signals: { take: 5, orderBy: { detectedAt: "desc" }, select: { signalType: true, importance: true, detectedAt: true } },
    },
  });

  if (!company) return [];

  const recommendations: RecommendationData[] = [];
  const ai = company.aiAnalyses[0];
  const priorityResult = await calculatePriority(companyId);

  // 1. High priority — score >= 75
  if (priorityResult.score >= 75) {
    recommendations.push({
      companyId, action: "high_priority",
      reason: `Dynamic priority score is ${priorityResult.score}/100. Key factors: ${priorityResult.explanation.slice(0, 3).map((e) => e.factor).join(", ")}.`,
      priority: 90,
    });
  }

  // 2. Needs re-analysis — AI analysis is old or missing
  if (!ai) {
    recommendations.push({
      companyId, action: "analyze",
      reason: "Company has not been analyzed by AI yet. Run analysis to get intelligence.",
      priority: 80,
    });
  } else {
    const daysSinceAnalysis = (Date.now() - ai.analyzedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAnalysis > 30) {
      recommendations.push({
        companyId, action: "analyze",
        reason: `Last AI analysis was ${Math.round(daysSinceAnalysis)} days ago. Company data may have changed.`,
        priority: 65,
      });
    }
  }

  // 3. Needs re-enrichment — enrichment is old or missing
  if (!company.lastEnrichedAt) {
    recommendations.push({
      companyId, action: "re-enrich",
      reason: "Company has not been enriched yet. Run enrichment to collect website data.",
      priority: 75,
    });
  } else {
    const daysSinceEnrichment = (Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEnrichment > 14) {
      recommendations.push({
        companyId, action: "re-enrich",
        reason: `Last enrichment was ${Math.round(daysSinceEnrichment)} days ago. Website may have changed.`,
        priority: 60,
      });
    }
  }

  // 4. Low confidence — AI confidence is low
  if (ai && ai.overallConfidence !== null && ai.overallConfidence < 50) {
    recommendations.push({
      companyId, action: "needs_review",
      reason: `AI confidence is only ${ai.overallConfidence}%. Manual review recommended.`,
      priority: 55,
    });
  }

  // 5. Export now — high qualification + high ICP match
  if (ai && ai.qualificationScore !== null && ai.qualificationScore >= 70 && ai.icpMatchPct !== null && ai.icpMatchPct >= 70) {
    recommendations.push({
      companyId, action: "export",
      reason: `Strong lead: qualification ${ai.qualificationScore}, ICP match ${ai.icpMatchPct}%. Export to your outreach tool.`,
      priority: 85,
    });
  }

  // 6. Watch — recent signals detected
  const recentSignals = company.signals.filter((s) => {
    const daysAgo = (Date.now() - s.detectedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7;
  });
  if (recentSignals.length > 0) {
    recommendations.push({
      companyId, action: "watch",
      reason: `${recentSignals.length} recent signal(s) detected: ${recentSignals.map((s) => s.signalType).join(", ")}.`,
      priority: 70,
    });
  }

  // Store recommendations
  for (const rec of recommendations) {
    await db.recommendation.upsert({
      where: { companyId_action: { companyId: rec.companyId, action: rec.action } } as never,
      create: { companyId: rec.companyId, action: rec.action, reason: rec.reason, priority: rec.priority },
      update: { reason: rec.reason, priority: rec.priority, isDismissed: false },
    }).catch(() => {
      // Upsert might fail if compound unique doesn't exist — use createOrUpdate instead
    });
  }

  return recommendations;
}

/**
 * Get recommendations for a company.
 */
export async function getCompanyRecommendations(companyId: string) {
  return db.recommendation.findMany({
    where: { companyId, isDismissed: false },
    orderBy: { priority: "desc" },
  });
}

/**
 * Get top recommendations across all companies.
 */
export async function getTopRecommendations(limit: number = 20) {
  return db.recommendation.findMany({
    where: { isDismissed: false, priority: { gte: 60 } },
    orderBy: { priority: "desc" },
    take: limit,
    include: { company: { select: { id: true, name: true, domain: true, logoUrl: true, industry: true } } },
  });
}
