/**
 * GET /api/v1/health
 *
 * Liveness + readiness probe. Used by Docker healthchecks and the
 * System page in the dashboard.
 *
 * Returns: { status, version, timestamp, uptime, services, workers }
 */

import { db } from "@/lib/db";
import { apiSuccess, getRequestContext } from "@/server/utils/api";
import { ensureWorkerStarted } from "@/server/discovery/worker/bootstrap";
import { getWorkerStatus } from "@/server/discovery/worker/worker";
import { getEnrichmentWorkerStatus } from "@/server/enrichment/worker/worker";
import { ensureAIWorkerStarted } from "@/server/ai/worker/bootstrap";
import { getAIWorkerStatus } from "@/server/ai/worker/worker";
import { getCircuitBreakerStatus, getLLMConfig } from "@/server/ai/freellm-client";
import { integrationManager } from "@/server/integrations/manager";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  const start = performance.now();

  ensureWorkerStarted();
  ensureAIWorkerStarted();

  const services: Record<string, { status: string; latencyMs?: number; details?: string }> = {};

  // Database
  try {
    await db.$queryRaw`SELECT 1`;
    services.database = {
      status: "up",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (e) {
    services.database = {
      status: "down",
      details: e instanceof Error ? e.message : "Unknown error",
    };
  }

  // Queue sizes (pending jobs)
  const [discoveryQueue, enrichmentQueue, aiQueue] = await Promise.all([
    db.discoveryJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }),
    db.enrichmentJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }),
    db.aIAnalysis.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }),
  ]);

  // Discovery worker
  const discoveryWorker = getWorkerStatus();
  const discoveryActiveJob = discoveryWorker.activeJobs[0];
  services.discoveryWorker = {
    status: discoveryWorker.running ? "up" : "down",
    details: discoveryWorker.running
      ? `${discoveryWorker.activeJobCount} active jobs · ${discoveryQueue} queued`
      : "Worker not running",
  };

  // Enrichment worker
  const enrichmentWorker = getEnrichmentWorkerStatus();
  const enrichmentActiveJob = enrichmentWorker.activeJobs[0];
  services.enrichmentWorker = {
    status: enrichmentWorker.running ? "up" : "down",
    details: enrichmentWorker.running
      ? `${enrichmentWorker.activeJobCount} active jobs · ${enrichmentQueue} queued`
      : "Worker not running",
  };

  // AI worker
  const aiWorker = getAIWorkerStatus();
  const aiActiveJob = aiWorker.activeJobs[0];
  services.aiWorker = {
    status: aiWorker.running ? "up" : "down",
    details: aiWorker.running
      ? `${aiWorker.activeJobCount} active jobs · ${aiQueue} queued`
      : "Worker not running",
  };

  // Integration Manager health checks
  const integrationHealth = await integrationManager.checkAllHealth(true);
  for (const [id, health] of integrationHealth) {
    services[id] = {
      status: health.status === "connected" ? "up" : health.status === "disconnected" ? "down" : "degraded",
      latencyMs: health.latencyMs,
      details: health.error || health.version || "OK",
    };
  }

  // FreeLLM circuit breaker (keep backward compat)
  const circuitBreaker = getCircuitBreakerStatus();
  const llmConfig = await getLLMConfig();
  if (!services.freellm) {
    services.freellm = {
      status: llmConfig.baseUrl && llmConfig.apiKey ? (circuitBreaker.isOpen ? "degraded" : "up") : "down",
      details: !llmConfig.baseUrl
        ? "FreeLLM base URL not configured — set in Settings > Infrastructure"
        : !llmConfig.apiKey
        ? "FreeLLM API key not configured — set in Settings > Infrastructure"
        : circuitBreaker.isOpen
        ? `Circuit breaker open — resets in ${Math.ceil(circuitBreaker.resetIn / 1000)}s`
        : `Connected to ${llmConfig.baseUrl}`,
    };
  }

  const allUp = Object.values(services).every(
    (s) => s.status === "up" || s.status === "pending" || s.status === "degraded"
  );
  const status = allUp ? "healthy" : "degraded";

  const memoryUsage = process.memoryUsage();

  return apiSuccess(
    {
      status,
      version: "8.0.0-production",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
      workers: {
        discovery: {
          ...discoveryWorker,
          queueSize: discoveryQueue,
          currentJob: discoveryActiveJob ?? null,
          lastHeartbeat: discoveryWorker.activeJobs.length > 0 ? new Date().toISOString() : null,
          memory: {
            rss: memoryUsage.rss,
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
          },
        },
        enrichment: {
          ...enrichmentWorker,
          queueSize: enrichmentQueue,
          currentJob: enrichmentActiveJob ?? null,
          lastHeartbeat: enrichmentWorker.activeJobs.length > 0 ? new Date().toISOString() : null,
          memory: {
            rss: memoryUsage.rss,
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
          },
        },
        ai: {
          ...aiWorker,
          queueSize: aiQueue,
          currentJob: aiActiveJob ?? null,
          lastHeartbeat: aiWorker.activeJobs.length > 0 ? new Date().toISOString() : null,
          memory: {
            rss: memoryUsage.rss,
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
          },
        },
      },
    },
    { requestId: ctx.requestId }
  );
}
