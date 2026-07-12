/**
 * =============================================================================
 * System Metrics — operational observability
 * =============================================================================
 *
 * Records structured metrics for monitoring:
 *  - Request counts and response times
 *  - Queue depth
 *  - Worker health
 *  - Crawl duration
 *  - AI latency
 *  - Export duration
 *  - Cache hit rate
 *  - Database query times
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";

export interface MetricPoint {
  metric: string;
  value: number;
  unit?: string;
  labels?: Record<string, string>;
}

/**
 * Record a metric point.
 */
export async function recordMetric(metric: string, value: number, unit?: string, labels?: Record<string, string>): Promise<void> {
  try {
    await db.systemMetric.create({
      data: {
        metric,
        value,
        unit: unit ?? null,
        labels: JSON.stringify(labels ?? {}),
      },
    });
  } catch (err) {
    // Metrics are best-effort — don't crash on failure
    logger.debug("metric.recordFailed", { metric, error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Record a timing metric (converts ms to seconds if > 1000).
 */
export async function recordTiming(metric: string, durationMs: number, labels?: Record<string, string>): Promise<void> {
  await recordMetric(metric, durationMs, "ms", labels);
}

/**
 * Get metrics for a specific metric name within a time range.
 */
export async function getMetrics(metric: string, since: Date, limit: number = 1000): Promise<Array<{
  value: number;
  unit: string | null;
  labels: Record<string, string>;
  timestamp: Date;
}>> {
  const metrics = await db.systemMetric.findMany({
    where: { metric, timestamp: { gte: since } },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return metrics.map((m) => ({
    value: m.value,
    unit: m.unit,
    labels: safeParse(m.labels),
    timestamp: m.timestamp,
  }));
}

/**
 * Get summary statistics for a metric within a time range.
 */
export async function getMetricSummary(metric: string, since: Date): Promise<{
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}> {
  const metrics = await db.systemMetric.findMany({
    where: { metric, timestamp: { gte: since } },
    select: { value: true },
    take: 10000,
  });

  if (metrics.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
  }

  const values = metrics.map((m) => m.value).sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    count: values.length,
    avg: sum / values.length,
    min: values[0]!,
    max: values[values.length - 1]!,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}

/**
 * Get a dashboard of all key metrics for the System page.
 */
export async function getMetricsDashboard(): Promise<{
  apiLatency: { avg: number; p95: number; p99: number };
  aiLatency: { avg: number; p95: number; p99: number };
  crawlDuration: { avg: number; p95: number; p99: number };
  exportDuration: { avg: number; p95: number; p99: number };
  requestCount: number;
  errorCount: number;
  cacheHitRate: number;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [apiLatency, aiLatency, crawlDuration, exportDuration, requestCount, errorCount, cacheHits, cacheMisses] = await Promise.all([
    getMetricSummary("api.response_time_ms", oneHourAgo),
    getMetricSummary("ai.duration_ms", oneHourAgo),
    getMetricSummary("crawl.duration_ms", oneHourAgo),
    getMetricSummary("export.duration_ms", oneHourAgo),
    db.systemMetric.count({ where: { metric: "api.request", timestamp: { gte: oneHourAgo } } }),
    db.systemMetric.count({ where: { metric: "api.error", timestamp: { gte: oneHourAgo } } }),
    db.systemMetric.count({ where: { metric: "cache.hit", timestamp: { gte: oneHourAgo } } }),
    db.systemMetric.count({ where: { metric: "cache.miss", timestamp: { gte: oneHourAgo } } }),
  ]);

  const totalCacheOps = cacheHits + cacheMisses;

  return {
    apiLatency: { avg: apiLatency.avg, p95: apiLatency.p95, p99: apiLatency.p99 },
    aiLatency: { avg: aiLatency.avg, p95: aiLatency.p95, p99: aiLatency.p99 },
    crawlDuration: { avg: crawlDuration.avg, p95: crawlDuration.p95, p99: crawlDuration.p99 },
    exportDuration: { avg: exportDuration.avg, p95: exportDuration.p95, p99: exportDuration.p99 },
    requestCount,
    errorCount,
    cacheHitRate: totalCacheOps > 0 ? cacheHits / totalCacheOps : 0,
  };
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil(sortedValues.length * p) - 1;
  return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, idx))]!;
}

function safeParse(s: string | null): Record<string, string> {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}
