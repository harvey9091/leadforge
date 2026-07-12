/**
 * =============================================================================
 * Source Metrics Engine — Phase 6
 * =============================================================================
 *
 * Tracks discovery performance per source and automatically ranks sources
 * by quality. Workers use this to prioritize high-value sources.
 *
 * Metrics tracked:
 *  - Companies discovered / retained
 *  - Duplicate percentage
 *  - Enrichment success rate
 *  - Average qualification score
 *  - Average confidence
 *  - Average ICP match
 *  - Export rate
 *  - Reliability score (based on failure history)
 *
 * Sources are ranked by a composite score that weights these metrics.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";
import type { SourceType } from "@prisma/client";

export interface SourceMetricData {
  sourceType: string;
  priority: number;
  companiesDiscovered: number;
  companiesRetained: number;
  duplicateCount: number;
  enrichmentSuccess: number;
  enrichmentFailure: number;
  avgQualificationScore: number;
  avgConfidence: number;
  avgIcpMatch: number;
  exportRate: number;
  reliabilityScore: number;
  lastCrawlAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  failureCount: number;
  consecutiveFailures: number;
}

/**
 * Default source priorities (from the architecture spec).
 */
export const DEFAULT_SOURCE_PRIORITIES: Record<string, number> = {
  YC: 100,
  PRODUCT_HUNT: 90,
  HACKER_NEWS: 80,
  BETALIST: 60,
  DEVHUNT: 50,
  UNEED: 40,
};

/**
 * Get or create source metrics for a source type.
 */
export async function getSourceMetric(sourceType: string): Promise<SourceMetricData> {
  let metric = await db.sourceMetric.findUnique({ where: { sourceType } });
  if (!metric) {
    metric = await db.sourceMetric.create({
      data: {
        sourceType,
        priority: DEFAULT_SOURCE_PRIORITIES[sourceType] ?? 50,
        reliabilityScore: 50,
      },
    });
  }
  return metric as unknown as SourceMetricData;
}

/**
 * Get all source metrics, sorted by composite score (best first).
 */
export async function getAllSourceMetrics(): Promise<SourceMetricData[]> {
  const metrics = await db.sourceMetric.findMany();
  // Seed defaults for known sources that don't have metrics yet
  for (const sourceType of Object.keys(DEFAULT_SOURCE_PRIORITIES)) {
    if (!metrics.find((m) => m.sourceType === sourceType)) {
      const created = await db.sourceMetric.create({
        data: {
          sourceType,
          priority: DEFAULT_SOURCE_PRIORITIES[sourceType]!,
          reliabilityScore: 50,
        },
      });
      metrics.push(created);
    }
  }
  return metrics.sort((a, b) => calculateCompositeScore(b as SourceMetricData) - calculateCompositeScore(a as SourceMetricData));
}

/**
 * Calculate a composite score for ranking sources.
 * Higher = better source.
 *
 * Factors:
 *  - Retention rate (retained / discovered) — weight: 25%
 *  - Avg qualification score — weight: 20%
 *  - Avg confidence — weight: 15%
 *  - Avg ICP match — weight: 15%
 *  - Enrichment success rate — weight: 10%
 *  - Reliability score — weight: 10%
 *  - Low duplicate rate — weight: 5%
 */
export function calculateCompositeScore(metric: SourceMetricData): number {
  const retentionRate = metric.companiesDiscovered > 0
    ? metric.companiesRetained / metric.companiesDiscovered
    : 0;
  const duplicateRate = metric.companiesDiscovered > 0
    ? metric.duplicateCount / metric.companiesDiscovered
    : 0;
  const enrichmentSuccessRate = (metric.enrichmentSuccess + metric.enrichmentFailure) > 0
    ? metric.enrichmentSuccess / (metric.enrichmentSuccess + metric.enrichmentFailure)
    : 0;

  return (
    retentionRate * 25 +
    (metric.avgQualificationScore / 100) * 20 +
    (metric.avgConfidence / 100) * 15 +
    (metric.avgIcpMatch / 100) * 15 +
    enrichmentSuccessRate * 10 +
    (metric.reliabilityScore / 100) * 10 +
    (1 - duplicateRate) * 5
  );
}

/**
 * Record a successful discovery from a source.
 */
export async function recordDiscovery(sourceType: string, retained: boolean, isDuplicate: boolean): Promise<void> {
  const metric = await getSourceMetric(sourceType);
  await db.sourceMetric.update({
    where: { sourceType },
    data: {
      companiesDiscovered: { increment: 1 },
      companiesRetained: retained ? { increment: 1 } : undefined,
      duplicateCount: isDuplicate ? { increment: 1 } : undefined,
      lastSuccessAt: new Date(),
      consecutiveFailures: 0,
    },
  });
}

/**
 * Record an enrichment result for a source.
 */
export async function recordEnrichment(sourceType: string, success: boolean): Promise<void> {
  const metric = await getSourceMetric(sourceType);
  await db.sourceMetric.update({
    where: { sourceType },
    data: success
      ? { enrichmentSuccess: { increment: 1 } }
      : { enrichmentFailure: { increment: 1 } },
  });
}

/**
 * Update AI metrics for a source (called after AI analysis completes).
 */
export async function updateAIMetrics(sourceType: string, qualificationScore: number, confidence: number, icpMatch: number): Promise<void> {
  const metric = await getSourceMetric(sourceType);

  // Running average — simple incremental average
  const n = metric.companiesRetained || 1;
  const newAvgQual = metric.avgQualificationScore + (qualificationScore - metric.avgQualificationScore) / n;
  const newAvgConf = metric.avgConfidence + (confidence - metric.avgConfidence) / n;
  const newAvgIcp = metric.avgIcpMatch + (icpMatch - metric.avgIcpMatch) / n;

  await db.sourceMetric.update({
    where: { sourceType },
    data: {
      avgQualificationScore: newAvgQual,
      avgConfidence: newAvgConf,
      avgIcpMatch: newAvgIcp,
    },
  });
}

/**
 * Record a source failure.
 */
export async function recordFailure(sourceType: string): Promise<void> {
  const metric = await getSourceMetric(sourceType);
  const newReliability = Math.max(0, metric.reliabilityScore - (metric.consecutiveFailures + 1) * 5);
  await db.sourceMetric.update({
    where: { sourceType },
    data: {
      failureCount: { increment: 1 },
      consecutiveFailures: { increment: 1 },
      lastFailureAt: new Date(),
      reliabilityScore: newReliability,
    },
  });
  logger.warn("sourceMetric.failure", { sourceType, consecutiveFailures: metric.consecutiveFailures + 1, reliability: newReliability });
}

/**
 * Record a successful crawl (resets failure streak).
 */
export async function recordCrawlSuccess(sourceType: string): Promise<void> {
  await db.sourceMetric.update({
    where: { sourceType },
    data: {
      lastCrawlAt: new Date(),
      consecutiveFailures: 0,
      reliabilityScore: Math.min(100, (await getSourceMetric(sourceType)).reliabilityScore + 2),
    },
  });
}

/**
 * Get sources sorted by priority (best first).
 * Used by the discovery worker to decide which sources to process first.
 */
export async function getPrioritizedSources(sourceIds: string[]): Promise<string[]> {
  const metrics = await getAllSourceMetrics();
  const filtered = metrics.filter((m) => sourceIds.includes(m.sourceType));
  return filtered.map((m) => m.sourceType);
}

/**
 * Recalculate and update priorities based on composite scores.
 * Called periodically to auto-rank sources.
 */
export async function recalculatePriorities(): Promise<void> {
  const metrics = await getAllSourceMetrics();
  const maxScore = Math.max(...metrics.map((m) => calculateCompositeScore(m)), 1);

  for (const metric of metrics) {
    const score = calculateCompositeScore(metric);
    const newPriority = Math.round((score / maxScore) * 100);
    if (Math.abs(newPriority - metric.priority) > 5) {
      await db.sourceMetric.update({
        where: { sourceType: metric.sourceType },
        data: { priority: newPriority },
      });
      logger.info("sourceMetric.priorityUpdated", {
        sourceType: metric.sourceType,
        oldPriority: metric.priority,
        newPriority,
        score: score.toFixed(1),
      });
    }
  }
}
