/**
 * =============================================================================
 * Leadforge Worker — standalone entrypoint
 * =============================================================================
 *
 * Runs only the background workers inside the Next.js standalone runtime:
 *   - Discovery worker
 *   - Enrichment worker
 *   - AI worker
 *
 * This process does NOT start the HTTP server. It keeps the Node.js event
 * loop alive and relies on the same bootstrap/worker singletons that the web
 * process uses, so no business logic is duplicated.
 *
 * Usage:
 *   node workers/dist/entrypoint.js
 */

import { ensureWorkerStarted } from "../../src/server/discovery/worker/bootstrap";
import { ensureEnrichmentWorkerStarted } from "../../src/server/enrichment/worker/bootstrap";
import { ensureAIWorkerStarted } from "../../src/server/ai/worker/bootstrap";
import { env } from "../../src/server/config/env";
import { logger } from "../../src/server/utils/logger";

function bootstrap() {
  logger.info("worker.entrypoint.starting", {
    nodeEnv: env.nodeEnv,
    discoveryConcurrency: env.worker.discoveryConcurrency,
    enrichmentConcurrency: env.worker.enrichmentConcurrency,
    aiConcurrency: env.worker.aiConcurrency,
  });

  ensureWorkerStarted();
  ensureEnrichmentWorkerStarted();
  ensureAIWorkerStarted();

  logger.info("worker.entrypoint.ready", {
    message: "All workers started — waiting for jobs",
  });
}

try {
  bootstrap();
} catch (err) {
  logger.error("worker.entrypoint.failed", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
}
