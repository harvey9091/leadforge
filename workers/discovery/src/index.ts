/**
 * =============================================================================
 * Leadforge — Discovery Worker (Phase 2)
 * =============================================================================
 *
 * Consumes discovery jobs from RabbitMQ and runs the discovery service.
 *
 * Queue: leadforge.jobs.discovery
 * Concurrency: configurable via WORKER_CONCURRENCY (default 4)
 *
 * Phase 1 status: interface defined, no implementation.
 * =============================================================================
 */

export interface WorkerConfig {
  rabbitmqUrl: string;
  concurrency: number;
  /** Max retries before dead-lettering */
  maxRetries: number;
}

export interface DiscoveryJob {
  source: string;
  cursor?: string;
}

export interface DiscoveryJobResult {
  discovered: number;
  nextCursor?: string;
  durationMs: number;
}

export async function startDiscoveryWorker(_config: WorkerConfig): Promise<void> {
  throw new Error("Not implemented — Phase 2");
}
