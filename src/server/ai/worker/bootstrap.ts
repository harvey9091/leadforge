/**
 * AI Worker Bootstrap — lazy initialization.
 */

import { startAIWorker, getAIWorkerStatus } from "./worker";
import { logger } from "@/server/utils/logger";

let initialized = false;

export function ensureAIWorkerStarted(): void {
  if (initialized) return;
  if (typeof window !== "undefined") return;
  initialized = true;
  try {
    startAIWorker();
    logger.info("ai.bootstrap.complete", { status: getAIWorkerStatus() });
  } catch (err) {
    initialized = false;
    logger.error("ai.bootstrap.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function getAIWorkerStatusWithAutoInit() {
  ensureAIWorkerStarted();
  return getAIWorkerStatus();
}
