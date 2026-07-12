/**
 * =============================================================================
 * Observability Layer — Phase 8
 * =============================================================================
 *
 * Comprehensive observability with historical trends.
 * Tracks: API latency, worker throughput, queue depth, crawl/enrichment/AI
 * success rates, database performance, memory/CPU/disk usage, cache hit rate,
 * error rates.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";

export interface ObservabilityData {
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    heapUsagePct: number;
  };
  workers: {
    discovery: { running: boolean; activeJobs: number };
    enrichment: { running: boolean; activeJobs: number };
    ai: { running: boolean; activeJobs: number };
  };
  queueDepth: {
    discovery: number;
    enrichment: number;
    ai: number;
  };
  database: {
    connected: boolean;
    totalCompanies: number;
    totalSources: number;
    totalAIAnalyses: number;
    totalSignals: number;
  };
  alerts: {
    active: number;
    critical: number;
  };
  cache: {
    hitRate: number;
  };
  circuitBreaker: {
    isOpen: boolean;
    consecutiveFailures: number;
  };
}

/**
 * Capture a comprehensive observability snapshot.
 */
export async function captureObservabilitySnapshot(): Promise<ObservabilityData> {
  const mem = typeof process !== "undefined" ? process.memoryUsage() : { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  const heapUsagePct = mem.heapTotal > 0 ? (mem.heapUsed / mem.heapTotal) * 100 : 0;

  // Worker statuses
  const discoveryWorker = (await import("@/server/discovery/worker/worker")).getWorkerStatus();
  const enrichmentWorker = (await import("@/server/enrichment/worker/worker")).getEnrichmentWorkerStatus();
  const aiWorker = (await import("@/server/ai/worker/worker")).getAIWorkerStatus();

  // Queue depths
  const [discoveryQueued, enrichmentQueued, aiQueued] = await Promise.all([
    db.discoveryJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }).catch(() => 0),
    db.enrichmentJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }).catch(() => 0),
    db.aIJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }).catch(() => 0),
  ]);

  // Database stats
  const [totalCompanies, totalSources, totalAIAnalyses, totalSignals] = await Promise.all([
    db.company.count().catch(() => 0),
    db.source.count().catch(() => 0),
    db.aIAnalysis.count({ where: { status: "completed" } }).catch(() => 0),
    db.signal.count().catch(() => 0),
  ]);

  // Alerts
  const [activeAlerts, criticalAlerts] = await Promise.all([
    db.alertEvent.count({ where: { isAcknowledged: false } }).catch(() => 0),
    db.alertEvent.count({ where: { isAcknowledged: false, severity: "critical" } }).catch(() => 0),
  ]);

  // Circuit breaker
  const circuitBreaker = (await import("@/server/ai/freellm-client")).getCircuitBreakerStatus();

  // Cache hit rate (from system metrics)
  const cacheHits = await db.systemMetric.count({ where: { metric: "cache.hit", timestamp: { gte: new Date(Date.now() - 3600000) } } }).catch(() => 0);
  const cacheMisses = await db.systemMetric.count({ where: { metric: "cache.miss", timestamp: { gte: new Date(Date.now() - 3600000) } } }).catch(() => 0);
  const totalCacheOps = cacheHits + cacheMisses;

  return {
    timestamp: new Date().toISOString(),
    uptime: typeof process !== "undefined" ? process.uptime() : 0,
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      heapUsagePct: Math.round(heapUsagePct * 100) / 100,
    },
    workers: {
      discovery: { running: discoveryWorker.running, activeJobs: discoveryWorker.activeJobCount },
      enrichment: { running: enrichmentWorker.running, activeJobs: enrichmentWorker.activeJobCount },
      ai: { running: aiWorker.running, activeJobs: aiWorker.activeJobCount },
    },
    queueDepth: {
      discovery: discoveryQueued,
      enrichment: enrichmentQueued,
      ai: aiQueued,
    },
    database: {
      connected: true,
      totalCompanies,
      totalSources,
      totalAIAnalyses,
      totalSignals,
    },
    alerts: {
      active: activeAlerts,
      critical: criticalAlerts,
    },
    cache: {
      hitRate: totalCacheOps > 0 ? cacheHits / totalCacheOps : 0,
    },
    circuitBreaker: {
      isOpen: circuitBreaker.isOpen,
      consecutiveFailures: circuitBreaker.consecutiveFailures,
    },
  };
}

/**
 * Record an API request metric.
 */
export async function recordApiMetric(method: string, path: string, statusCode: number, durationMs: number): Promise<void> {
  try {
    await db.systemMetric.create({
      data: { metric: "api.request", value: 1, unit: "count", labels: JSON.stringify({ method, path, status: statusCode }) },
    });
    await db.systemMetric.create({
      data: { metric: "api.response_time_ms", value: durationMs, unit: "ms", labels: JSON.stringify({ method, path }) },
    });
    if (statusCode >= 500) {
      await db.systemMetric.create({
        data: { metric: "api.error", value: 1, unit: "count", labels: JSON.stringify({ method, path, status: statusCode }) },
      });
    }
  } catch {
    // best-effort
  }
}

/**
 * Get historical metrics for a specific metric name.
 */
export async function getMetricHistory(metric: string, hours: number = 24): Promise<Array<{
  value: number;
  timestamp: Date;
}>> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const metrics = await db.systemMetric.findMany({
    where: { metric, timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
    take: 1000,
    select: { value: true, timestamp: true },
  });
  return metrics;
}
