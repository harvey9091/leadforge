/**
 * =============================================================================
 * Worker Bootstrap
 * =============================================================================
 *
 * Initializes the discovery worker. Uses lazy initialization — the worker
 * starts on the first API request after server boot, not at module load
 * time. This avoids Edge Runtime compatibility issues with instrumentation.
 *
 * The `ensureWorkerStarted()` function is called from API route handlers
 * (which run in the Node.js runtime). It's idempotent — calling it multiple
 * times is a no-op after the first call.
 * =============================================================================
 */

import { startDiscoveryWorker, getWorkerStatus } from "./worker";
import { logger } from "@/server/utils/logger";

let initialized = false;

/**
 * Start the discovery worker if it hasn't been started yet.
 * Safe to call multiple times. Must be called from a server-side context.
 */
export function ensureWorkerStarted(): void {
  if (initialized) return;
  if (typeof window !== "undefined") return;

  initialized = true;

  try {
    startDiscoveryWorker();
    logger.info("worker.bootstrap.complete", { status: getWorkerStatus() });
  } catch (err) {
    initialized = false; // allow retry
    logger.error("worker.bootstrap.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get the current worker status. Also triggers lazy initialization
 * on first call.
 */
export function getWorkerStatusWithAutoInit() {
  ensureWorkerStarted();
  return getWorkerStatus();
}
