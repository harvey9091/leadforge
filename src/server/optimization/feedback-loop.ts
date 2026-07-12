/**
 * =============================================================================
 * Quality Feedback Loop — Phase 6
 * =============================================================================
 *
 * Allows users to mark companies as:
 *  - excellent — high-quality lead
 *  - good — decent lead
 *  - poor — low-quality lead
 *  - false_positive — not a real lead
 *
 * This feedback is used to adjust:
 *  - Discovery source priorities
 *  - Qualification score weighting
 *  - AI prompt effectiveness
 *  - Export recommendations
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";
import { getSourceMetric, updateAIMetrics } from "./source-metrics";

export type FeedbackRating = "excellent" | "good" | "poor" | "false_positive";

export interface FeedbackSummary {
  excellent: number;
  good: number;
  poor: number;
  false_positive: number;
  total: number;
  qualityScore: number;
}

/**
 * Record user feedback for a company.
 */
export async function recordFeedback(companyId: string, rating: FeedbackRating, notes?: string, userId?: string): Promise<void> {
  await db.companyFeedback.create({
    data: { companyId, rating, notes, userId },
  });

  // Adjust source metrics based on feedback
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { sources: { select: { type: true } } },
  });

  if (company) {
    for (const source of company.sources) {
      await adjustSourceForFeedback(source.type, rating);
    }
  }

  logger.info("feedback.recorded", { companyId, rating, sourceTypes: company?.sources.map((s) => s.type) });
}

/**
 * Get feedback summary for a company.
 */
export async function getCompanyFeedback(companyId: string): Promise<FeedbackSummary> {
  const feedback = await db.companyFeedback.findMany({
    where: { companyId },
    select: { rating: true },
  });

  const summary: FeedbackSummary = {
    excellent: 0,
    good: 0,
    poor: 0,
    false_positive: 0,
    total: feedback.length,
    qualityScore: 0,
  };

  for (const f of feedback) {
    switch (f.rating) {
      case "excellent": summary.excellent++; break;
      case "good": summary.good++; break;
      case "poor": summary.poor++; break;
      case "false_positive": summary.false_positive++; break;
    }
  }

  // Calculate quality score: excellent=100, good=70, poor=30, false_positive=0
  if (summary.total > 0) {
    summary.qualityScore = Math.round(
      ((summary.excellent * 100 + summary.good * 70 + summary.poor * 30 + summary.false_positive * 0) / summary.total)
    );
  }

  return summary;
}

/**
 * Get aggregate feedback stats across all companies.
 */
export async function getFeedbackStats(): Promise<{
  totalFeedback: number;
  byRating: Record<FeedbackRating, number>;
  avgQualityScore: number;
  topRatedCompanies: Array<{ companyId: string; companyName: string; qualityScore: number }>;
}> {
  const allFeedback = await db.companyFeedback.findMany({
    select: { companyId: true, rating: true, company: { select: { name: true } } },
  });

  const byRating: Record<FeedbackRating, number> = {
    excellent: 0,
    good: 0,
    poor: 0,
    false_positive: 0,
  };

  const companyScores = new Map<string, { name: string; scores: number[] }>();

  for (const f of allFeedback) {
    byRating[f.rating as FeedbackRating] = (byRating[f.rating as FeedbackRating] ?? 0) + 1;

    if (!companyScores.has(f.companyId)) {
      companyScores.set(f.companyId, { name: f.company.name, scores: [] });
    }
    const score = f.rating === "excellent" ? 100 : f.rating === "good" ? 70 : f.rating === "poor" ? 30 : 0;
    companyScores.get(f.companyId)!.scores.push(score);
  }

  const topRatedCompanies = Array.from(companyScores.entries())
    .map(([companyId, { name, scores }]) => ({
      companyId,
      companyName: name,
      qualityScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 10);

  const allScores = Array.from(companyScores.values()).flatMap((c) => c.scores);
  const avgQualityScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  return {
    totalFeedback: allFeedback.length,
    byRating,
    avgQualityScore,
    topRatedCompanies,
  };
}

/**
 * Adjust source metrics based on user feedback.
 * Positive feedback increases reliability; negative decreases it.
 */
async function adjustSourceForFeedback(sourceType: string, rating: FeedbackRating): Promise<void> {
  const metric = await getSourceMetric(sourceType);
  const adjustment = rating === "excellent" ? 2 : rating === "good" ? 1 : rating === "poor" ? -1 : -3;

  const newReliability = Math.max(0, Math.min(100, metric.reliabilityScore + adjustment));
  await db.sourceMetric.update({
    where: { sourceType },
    data: { reliabilityScore: newReliability },
  });
}
