/**
 * Enrichment Worker Bootstrap — lazy initialization.
 * Same pattern as the discovery worker.
 */

import { startEnrichmentWorker, getEnrichmentWorkerStatus } from "./worker";
import { logger } from "@/server/utils/logger";

let initialized = false;

export function ensureEnrichmentWorkerStarted(): void {
  if (initialized) return;
  if (typeof window !== "undefined") return;

  initialized = true;

  try {
    startEnrichmentWorker();
    logger.info("enrichment.bootstrap.complete", { status: getEnrichmentWorkerStatus() });
  } catch (err) {
    initialized = false;
    logger.error("enrichment.bootstrap.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function getEnrichmentWorkerStatusWithAutoInit() {
  ensureEnrichmentWorkerStarted();
  return getEnrichmentWorkerStatus();
}
