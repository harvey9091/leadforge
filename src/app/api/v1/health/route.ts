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
import { checkFirecrawlHealth } from "@/server/enrichment/firecrawl-client";
import { ensureAIWorkerStarted } from "@/server/ai/worker/bootstrap";
import { getAIWorkerStatus } from "@/server/ai/worker/worker";
import { getCircuitBreakerStatus } from "@/server/ai/freellm-client";

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

  // Discovery worker
  const discoveryWorker = getWorkerStatus();
  services.discoveryWorker = {
    status: discoveryWorker.running ? "up" : "down",
    details: discoveryWorker.running
      ? `${discoveryWorker.activeJobCount} active jobs`
      : "Worker not running",
  };

  // Enrichment worker
  const enrichmentWorker = getEnrichmentWorkerStatus();
  services.enrichmentWorker = {
    status: enrichmentWorker.running ? "up" : "down",
    details: enrichmentWorker.running
      ? `${enrichmentWorker.activeJobCount} active jobs`
      : "Worker not running",
  };

  // AI worker
  const aiWorker = getAIWorkerStatus();
  services.aiWorker = {
    status: aiWorker.running ? "up" : "down",
    details: aiWorker.running
      ? `${aiWorker.activeJobCount} active jobs`
      : "Worker not running",
  };

  // FreeLLM / AI circuit breaker
  const circuitBreaker = getCircuitBreakerStatus();
  const llmConfig = getLLMConfig();
  services.freellm = {
    status: llmConfig.baseUrl && llmConfig.apiKey ? (circuitBreaker.isOpen ? "degraded" : "up") : "down",
    details: !llmConfig.baseUrl
      ? "FREELLM_BASE_URL not configured"
      : !llmConfig.apiKey
      ? "FREELLM_API_KEY not configured"
      : circuitBreaker.isOpen
      ? `Circuit breaker open — resets in ${Math.ceil(circuitBreaker.resetIn / 1000)}s`
      : `Connected to ${llmConfig.baseUrl}`,
  };

  // Firecrawl
  const firecrawlHealth = await checkFirecrawlHealth();
  services.firecrawl = {
    status: firecrawlHealth.available ? "up" : "degraded",
    latencyMs: firecrawlHealth.latencyMs,
    details: firecrawlHealth.available
      ? "Connected — using Firecrawl for crawling"
      : "Not configured — using direct HTTP fetch fallback",
  };

  // Redis / RabbitMQ — still Phase 3+
  services.redis = { status: "pending", details: "Not wired" };
  services.rabbitmq = { status: "pending", details: "Not wired" };

  const allUp = Object.values(services).every(
    (s) => s.status === "up" || s.status === "pending" || s.status === "degraded"
  );
  const status = allUp ? "healthy" : "degraded";

  return apiSuccess(
    {
      status,
      version: "8.0.0-production",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
      workers: {
        discovery: discoveryWorker,
        enrichment: enrichmentWorker,
        ai: aiWorker,
      },
    },
    { requestId: ctx.requestId }
  );
}
