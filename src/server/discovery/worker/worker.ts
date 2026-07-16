/**
 * =============================================================================
 * Discovery Worker
 * =============================================================================
 *
 * Processes discovery jobs from the queue. The worker is:
 *  - Restart-safe: job state is persisted to the DB. If the server crashes
 *    mid-job, the job is resumed (or marked as failed) on next boot.
 *  - Cancellable: checks `shouldContinue()` between each company.
 *  - Rate-limited: each source has its own rate limiter.
 *  - Resilient: network errors, parse errors, and source failures don't
 *    crash the worker — they're logged and the worker continues.
 *
 * Lifecycle:
 *  1. On boot, the worker singleton starts a poll loop (every 5 seconds).
 *  2. It looks for jobs in QUEUED or RETRYING status.
 *  3. For each job, it runs `processJob()` which:
 *     a. Sets status to RUNNING, records startedAt
 *     b. Iterates each source adapter
 *     c. For each RawCompany: normalize → validate → dedup → store
 *     d. Updates progress + heartbeat every iteration
 *     e. On completion: sets status to COMPLETED
 *     f. On error: sets status to FAILED (or RETRYING if retryable)
 *  4. Also recovers stale RUNNING jobs (heartbeat > 60s old) — marks them
 *     as RETRYING so they'll be picked up again.
 *
 * The worker runs in the Next.js server process (singleton). In Phase 3+,
 * this can be split into a separate worker process.
 * =============================================================================
 */

import { env } from "@/server/config/env";

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";
import { eventBus } from "@/server/events/event-bus";
import { getSources } from "../registry";
import { normalize } from "../normalizer";
import { validate } from "../validator";
import { findDuplicate } from "../dedup";
import { getSourceConfidence } from "../source-confidence";
import {
  discoveryJobRepository,
  discoveryLogRepository,
  companyRepository,
} from "@/server/repositories/discovery.repository";
import type {
  DiscoveryParams,
  DiscoveryContext,
  DiscoveryProgress,
  RawCompany,
} from "../types";
import type { SourceType } from "@prisma/client";

const POLL_INTERVAL_MS = env.worker.discoveryPollIntervalMs;
const HEARTBEAT_TIMEOUT_MS = env.worker.discoveryHeartbeatTimeoutMs;
const MAX_CONCURRENT_JOBS = env.worker.discoveryConcurrency;

// Worker ID is generated lazily to avoid using process.pid at module load time
// (Edge Runtime compatibility).
let _workerId: string | null = null;
function getWorkerId(): string {
  if (!_workerId) {
    const pid = typeof process !== "undefined" ? process.pid : 0;
    _workerId = `worker-${pid}-${Date.now().toString(36)}`;
  }
  return _workerId;
}

let workerStarted = false;
let pollHandle: ReturnType<typeof setInterval> | null = null;
let activeJobs = new Set<string>();

/**
 * Start the discovery worker. Safe to call multiple times — only starts once.
 */
export function startDiscoveryWorker(): void {
  if (workerStarted) return;
  workerStarted = true;

  const workerId = getWorkerId();
  logger.info("discovery.worker.starting", { workerId, pollIntervalMs: POLL_INTERVAL_MS });

  // Initial poll after 2 seconds (give the server time to boot)
  setTimeout(() => {
    void poll();
  }, 2_000);

  // Regular poll loop
  pollHandle = setInterval(() => {
    void poll();
  }, POLL_INTERVAL_MS);

  // Graceful shutdown — wrapped in try to avoid Edge Runtime issues
  try {
    if (typeof process !== "undefined" && process.on) {
      process.on("beforeExit", () => {
        if (pollHandle) clearInterval(pollHandle);
      });
    }
  } catch {
    // Edge Runtime — process.on not available, ignore
  }
}

/**
 * Get worker status for the System page.
 */
export function getWorkerStatus() {
  return {
    workerId: getWorkerId(),
    running: workerStarted,
    activeJobs: Array.from(activeJobs),
    activeJobCount: activeJobs.size,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}

/**
 * Poll for pending jobs and process them.
 */
async function poll(): Promise<void> {
  try {
    // Guard: ensure db is available
    if (!db.discoveryJob || typeof db.discoveryJob.findMany !== "function") {
      logger.warn("discovery.worker.poll.dbNotReady");
      return;
    }

    // 1. Recover stale jobs
    await recoverStaleJobs();

    // 2. Find pending jobs
    const pending = await discoveryJobRepository.findPending();
    if (pending.length === 0) return;

    logger.debug("discovery.worker.poll", { pendingCount: pending.length, activeCount: activeJobs.size });

    // 3. Process each pending job (limited concurrency)
    for (const job of pending) {
      if (activeJobs.has(job.id)) continue;
      if (activeJobs.size >= MAX_CONCURRENT_JOBS) break;

      activeJobs.add(job.id);
      void processJob(job.id).finally(() => {
        activeJobs.delete(job.id);
      });
    }
  } catch (err) {
    // Never crash the worker on a poll error — log and continue
    logger.error("discovery.worker.pollError", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Recover jobs that were RUNNING but the worker died (stale heartbeat).
 */
async function recoverStaleJobs(): Promise<void> {
  const staleBefore = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
  const staleJobs = await discoveryJobRepository.findStale(staleBefore);

  for (const job of staleJobs) {
    logger.warn("discovery.worker.recoverStale", { jobId: job.id, lastHeartbeat: job.lastHeartbeat });
    await discoveryJobRepository.setStatus(job.id, "RETRYING");
    await discoveryLogRepository.create({
      jobId: job.id,
      level: "WARN",
      message: "Job recovered from stale worker — will retry",
      metadata: { lastHeartbeat: job.lastHeartbeat, workerId: getWorkerId() },
    });
  }
}

/**
 * Process a single discovery job end-to-end.
 */
async function processJob(jobId: string): Promise<void> {
  const job = await discoveryJobRepository.findById(jobId);
  if (!job) {
    logger.error("discovery.worker.jobNotFound", { jobId });
    return;
  }

  // Check if job was cancelled while waiting
  if (job.status === "CANCELLED" || job.status === "COMPLETED") {
    activeJobs.delete(jobId);
    return;
  }

  logger.info("discovery.worker.jobStart", { jobId, name: job.name, sources: job.sources });

  // Set status to RUNNING
  await discoveryJobRepository.setStatus(jobId, "RUNNING", {
    startedAt: job.startedAt ?? new Date(),
    lastHeartbeat: new Date(),
    errorMessage: null,
  });

  await discoveryLogRepository.create({
    jobId,
    level: "INFO",
    message: `Job started — ${job.name}`,
    metadata: { workerId: getWorkerId(), sources: JSON.parse(job.sources), maxCompanies: job.maxCompanies },
  });

  // Emit DiscoveryStarted event
  await eventBus.emit("DiscoveryStarted", {
    jobId,
    jobName: job.name,
    sources: JSON.parse(job.sources),
    maxCompanies: job.maxCompanies,
    timestamp: new Date(),
  });

  // Add timeline entry
  await db.discoveryTimeline.create({
    data: { jobId, step: "started", message: `Job started: ${job.name}` },
  });

  // Build discovery params from job config
  const sourceIds = JSON.parse(job.sources) as SourceType[];
  const sources = getSources(sourceIds);
  const params: DiscoveryParams = {
    maxCompanies: job.maxCompanies,
    keywords: JSON.parse(job.keywords) as string[],
    categories: JSON.parse(job.categories) as string[],
    regions: JSON.parse(job.regions) as string[],
    fundingStages: JSON.parse(job.fundingStages) as string[],
    hiringOnly: job.hiringOnly,
    dateFrom: job.dateFrom ?? undefined,
    dateTo: job.dateTo ?? undefined,
    maxPages: 20,
  };

  const progress: DiscoveryProgress = {
    currentSource: "",
    currentPage: 0,
    totalPages: 0,
    companiesFound: job.companiesFound,
    companiesStored: job.companiesStored,
    duplicatesFound: job.duplicatesFound,
    errorsCount: job.errorsCount,
    retriesCount: job.retriesCount,
  };

  // Build the discovery context (callbacks for source adapters)
  const ctx: DiscoveryContext = {
    jobId,
    workerId: getWorkerId(),
    shouldContinue: () => isJobActive(jobId),
    log: async (level, message, metadata) => {
      try {
        await discoveryLogRepository.create({
          jobId,
          level: level.toUpperCase() as "DEBUG" | "INFO" | "WARN" | "ERROR",
          message,
          metadata,
        });
      } catch (err) {
        logger.error("discovery.worker.logError", {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    updateProgress: async (update) => {
      Object.assign(progress, update);
      try {
        await discoveryJobRepository.updateProgress(jobId, {
          ...progress,
          lastHeartbeat: new Date(),
        });
      } catch (err) {
        logger.error("discovery.worker.progressError", {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    sleep: async (ms) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (!isJobActive(jobId)) return;
        await new Promise((r) => setTimeout(r, Math.min(500, end - Date.now())));
      }
    },
  };

  let totalStored = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;
  let totalFound = 0;

  try {
    for (const source of sources) {
      // Re-check job status before each source
      const current = await discoveryJobRepository.findById(jobId);
      if (!current || current.status === "CANCELLED" || current.status === "PAUSED") {
        await discoveryLogRepository.create({
          jobId,
          level: "INFO",
          message: `Job ${current?.status === "PAUSED" ? "paused" : "cancelled"} — stopping at source: ${source.label}`,
        });
        await discoveryJobRepository.setStatus(jobId, current?.status ?? "CANCELLED", {
          pausedAt: current?.status === "PAUSED" ? new Date() : undefined,
        });
        return;
      }

      await discoveryLogRepository.create({
        jobId,
        level: "INFO",
        source: source.id,
        message: `Starting source: ${source.label}`,
      });

      // Track domains/names seen in this job for batch dedup
      const batchDomains: string[] = [];
      const batchNames: string[] = [];

      try {
        for await (const rawCompany of source.discover(params, ctx)) {
          if (!ctx.shouldContinue()) break;

          totalFound++;
          progress.companiesFound = totalFound;

          // 1. Normalize
          const normalized = normalize(rawCompany);

          // 2. Validate
          const validation = validate(normalized);
          if (!validation.valid) {
            await ctx.log("debug", `Rejected company: ${normalized.name || "unknown"} — ${validation.reason}`, {
              reasonCode: validation.reasonCode,
              domain: normalized.domain,
              source: source.id,
            });
            totalErrors++;
            progress.errorsCount = totalErrors;
            continue;
          }

          // 3. Dedup — check against DB
          const existing = await companyRepository.findForDedup(
            [normalized.domain!, normalized.apexDomain!].filter(Boolean),
            [normalized.name]
          );

          const dupResult = findDuplicate(normalized, existing);

          if (!dupResult.isNew && dupResult.existingCompanyId) {
            totalDuplicates++;
            progress.duplicatesFound = totalDuplicates;

            // Merge: update existing company + add source
            await companyRepository.mergeUpdate(dupResult.existingCompanyId, normalized);
            await companyRepository.addSource(dupResult.existingCompanyId, {
              type: normalized.source,
              externalId: normalized.sourceExternalId,
              url: normalized.sourceUrl,
              rawPayload: normalized.raw,
              discoveryJobId: jobId,
            });

            await ctx.log("info", `Duplicate merged: ${normalized.name} → existing company`, {
              matchStrategy: dupResult.matchStrategy,
              confidence: dupResult.confidence,
              existingCompanyId: dupResult.existingCompanyId,
            });

            // Record merge history
            await db.mergeHistory.create({
              data: {
                targetCompanyId: dupResult.existingCompanyId!,
                duplicateName: normalized.name,
                duplicateDomain: normalized.domain,
                matchStrategy: dupResult.matchStrategy,
                similarity: dupResult.confidence,
                operator: "system",
                jobId,
              },
            });

            // Emit CompanyMerged event
            await eventBus.emit("CompanyMerged", {
              companyId: dupResult.existingCompanyId!,
              duplicateName: normalized.name,
              duplicateDomain: normalized.domain,
              matchStrategy: dupResult.matchStrategy,
              similarity: dupResult.confidence,
              jobId,
              timestamp: new Date(),
            });
          } else {
            // 4. Store new company
            try {
              const companyId = await companyRepository.create(normalized);
              const sourceConfidence = getSourceConfidence(normalized.source);
              await companyRepository.addSource(companyId, {
                type: normalized.source,
                externalId: normalized.sourceExternalId,
                url: normalized.sourceUrl,
                rawPayload: normalized.raw,
                discoveryJobId: jobId,
                confidence: sourceConfidence,
              });

              totalStored++;
              progress.companiesStored = totalStored;

              await ctx.log("info", `Stored company: ${normalized.name} (${normalized.domain})`, {
                companyId,
                source: source.id,
              });

              // Emit CompanyDiscovered event
              await eventBus.emit("CompanyDiscovered", {
                companyId,
                jobId,
                source: normalized.source,
                name: normalized.name,
                domain: normalized.domain,
                confidence: sourceConfidence,
                timestamp: new Date(),
              });
            } catch (storeErr) {
              totalErrors++;
              progress.errorsCount = totalErrors;
              const storeErrorMsg = storeErr instanceof Error ? storeErr.message : String(storeErr);
              await ctx.log("error", `DB insert failed: ${normalized.name} — ${storeErrorMsg}`, {
                source: source.id,
                domain: normalized.domain,
                stack: storeErr instanceof Error ? storeErr.stack : undefined,
              });
            }
          }

          // Update heartbeat every 5 companies
          if (totalFound % 5 === 0) {
            const elapsed = Date.now() - (job.startedAt?.getTime() ?? Date.now());
            const rate = totalFound / (elapsed / 1000);
            const remaining = params.maxCompanies - totalFound;
            const eta = remaining > 0 && rate > 0 ? new Date(Date.now() + (remaining / rate) * 1000) : null;
            const progressUpdate: Record<string, unknown> = {
              ...progress,
              lastHeartbeat: new Date(),
            };
            if (eta) progressUpdate.estimatedCompletion = eta;
            await discoveryJobRepository.updateProgress(jobId, progressUpdate);
          }

          // Check max companies limit
          if (totalStored >= params.maxCompanies) {
            await ctx.log("info", `Reached max companies limit (${params.maxCompanies}) — stopping`);
            break;
          }
        }
      } catch (err) {
        totalErrors++;
        progress.errorsCount = totalErrors;
        const errorMsg = err instanceof Error ? err.message : String(err);
        await discoveryLogRepository.create({
          jobId,
          level: "ERROR",
          source: source.id,
          message: `Source error: ${errorMsg}`,
          metadata: { stack: err instanceof Error ? err.stack : undefined },
        });
        // Don't abort the whole job — continue with next source
      }

      await discoveryLogRepository.create({
        jobId,
        level: "INFO",
        source: source.id,
        message: `Source complete: ${source.label}`,
      });

      if (totalStored >= params.maxCompanies) break;
    }

    // Job complete
    await discoveryJobRepository.setStatus(jobId, "COMPLETED", {
      completedAt: new Date(),
      lastHeartbeat: new Date(),
      companiesFound: totalFound,
      companiesStored: totalStored,
      duplicatesFound: totalDuplicates,
      errorsCount: totalErrors,
    });

    await ctx.log("info", `Job completed — ${totalFound} found, ${totalStored} stored, ${totalDuplicates} duplicates, ${totalErrors} errors`, {
      totalFound,
      totalStored,
      totalDuplicates,
      totalErrors,
      sources: sourceIds,
    });

    // Add timeline entry
    await db.discoveryTimeline.create({
      data: { jobId, step: "completed", message: `Job completed: ${totalStored} companies stored` },
    });

    // Emit DiscoveryCompleted event
    await eventBus.emit("DiscoveryCompleted", {
      jobId,
      found: totalFound,
      stored: totalStored,
      duplicates: totalDuplicates,
      errors: totalErrors,
      durationMs: job.startedAt ? Date.now() - job.startedAt.getTime() : 0,
      timestamp: new Date(),
    });

    logger.info("discovery.worker.jobComplete", {
      jobId,
      workerId: getWorkerId(),
      name: job.name,
      sources: sourceIds,
      totalFound,
      totalStored,
      totalDuplicates,
      totalErrors,
      durationMs: job.startedAt ? Date.now() - job.startedAt.getTime() : 0,
    });
  } catch (err) {
    totalErrors++;
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("discovery.worker.jobError", {
      jobId,
      workerId: getWorkerId(),
      name: job.name,
      error: errorMsg,
      stack: err instanceof Error ? err.stack : undefined,
      totalFound,
      totalStored,
      totalDuplicates,
      totalErrors,
    });

    await discoveryJobRepository.setStatus(jobId, "FAILED", {
      completedAt: new Date(),
      errorMessage: errorMsg,
      errorsCount: totalErrors,
    });

    await discoveryLogRepository.create({
      jobId,
      level: "ERROR",
      source: progress.currentSource,
      message: `Job failed: ${errorMsg}`,
      metadata: {
        stack: err instanceof Error ? err.stack : undefined,
        totalFound,
        totalStored,
        totalDuplicates,
        totalErrors,
        workerId: getWorkerId(),
      },
    });

    // Emit DiscoveryFailed event
    await eventBus.emit("DiscoveryFailed", {
      jobId,
      error: errorMsg,
      timestamp: new Date(),
    });
  } finally {
    activeJobs.delete(jobId);
  }
}

/**
 * Check if a job is still active (not cancelled/paused).
 * Uses an in-memory set for fast checks.
 */
function isJobActive(jobId: string): boolean {
  return activeJobs.has(jobId);
}

/**
 * Manually trigger a job re-check (used by the API when a job is created).
 */
export function notifyNewJob(): void {
  setTimeout(() => void poll(), 100);
}
