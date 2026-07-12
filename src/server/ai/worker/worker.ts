/**
 * =============================================================================
 * AI Worker — Lead Intelligence Engine
 * =============================================================================
 *
 * Processes AI analysis jobs. For each job:
 *  1. Load the company + enrichment data
 *  2. Build the prompt (system + user)
 *  3. Check cache (skip if identical prompt was already processed)
 *  4. Call FreeLLM with structured JSON output
 *  5. Validate the response against the Zod schema
 *  6. Store results + evidence in the database
 *  7. Emit events
 *
 * Same lifecycle pattern as discovery + enrichment workers:
 *  - Queue-based polling
 *  - Pause / Resume / Retry / Cancel
 *  - Heartbeat + stale recovery
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";
import { eventBus } from "@/server/events/event-bus";
import { callFreeLLMForJSON, getLLMConfig } from "../freellm-client";
import { buildSystemPrompt, buildUserPrompt, hashPrompt, hashWebsiteContent, type PromptContext } from "../prompt-builder";
import { safeValidateAIAnalysis, type AIAnalysisResult } from "../schema";
import {
  aiAnalysisRepository,
  aiJobRepository,
  icpRepository,
  promptCacheRepository,
} from "@/server/repositories/ai.repository";

const POLL_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 180_000;
const MAX_CONCURRENT_JOBS = 1; // AI calls are expensive — 1 at a time

let workerStarted = false;
let pollHandle: ReturnType<typeof setInterval> | null = null;
let activeJobs = new Set<string>();

let _workerId: string | null = null;
function getWorkerId(): string {
  if (!_workerId) {
    const pid = typeof process !== "undefined" ? process.pid : 0;
    _workerId = `ai-${pid}-${Date.now().toString(36)}`;
  }
  return _workerId;
}

export function startAIWorker(): void {
  if (workerStarted) return;
  workerStarted = true;

  const workerId = getWorkerId();
  logger.info("ai.worker.starting", { workerId, pollIntervalMs: POLL_INTERVAL_MS });

  setTimeout(() => { void poll(); }, 15_000); // delay first poll
  pollHandle = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);

  try {
    if (typeof process !== "undefined" && process.on) {
      process.on("beforeExit", () => {
        if (pollHandle) clearInterval(pollHandle);
      });
    }
  } catch { /* Edge Runtime */ }
}

export function getAIWorkerStatus() {
  return {
    workerId: getWorkerId(),
    running: workerStarted,
    activeJobs: Array.from(activeJobs),
    activeJobCount: activeJobs.size,
    pollIntervalMs: POLL_INTERVAL_MS,
    maxConcurrent: MAX_CONCURRENT_JOBS,
  };
}

async function poll(): Promise<void> {
  try {
    if (!db.aIJob || typeof db.aIJob.findMany !== "function") return;

    // Recover stale jobs
    const staleBefore = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
    const staleJobs = await aiJobRepository.findStale(staleBefore);
    for (const job of staleJobs) {
      logger.warn("ai.worker.recoverStale", { jobId: job.id });
      await aiJobRepository.setStatus(job.id, "RETRYING");
    }

    // Find pending jobs
    const pending = await aiJobRepository.findPending(MAX_CONCURRENT_JOBS);
    if (pending.length === 0) return;

    for (const job of pending) {
      if (activeJobs.has(job.id)) continue;
      if (activeJobs.size >= MAX_CONCURRENT_JOBS) break;

      activeJobs.add(job.id);
      void processJob(job.id).finally(() => activeJobs.delete(job.id));
    }
  } catch (err) {
    logger.error("ai.worker.pollError", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function notifyNewAIJob(): void {
  setTimeout(() => void poll(), 100);
}

async function processJob(jobId: string): Promise<void> {
  const job = await aiJobRepository.findById(jobId);
  if (!job) return;

  if (job.status === "CANCELLED" || job.status === "COMPLETED") {
    activeJobs.delete(jobId);
    return;
  }

  logger.info("ai.worker.jobStart", { jobId, companyId: job.companyId });

  await aiJobRepository.setStatus(jobId, "RUNNING", {
    startedAt: job.startedAt ?? new Date(),
    lastHeartbeat: new Date(),
    workerId: getWorkerId(),
    errorMessage: null,
  });

  try {
    if (job.type === "batch") {
      await processBatchJob(jobId, job.batchId ?? null);
    } else {
      await processSingleJob(jobId, job.companyId ?? null);
    }

    await aiJobRepository.setStatus(jobId, "COMPLETED", {
      completedAt: new Date(),
      lastHeartbeat: new Date(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("ai.worker.jobError", { jobId, error: errorMsg });

    await aiJobRepository.setStatus(jobId, "FAILED", {
      completedAt: new Date(),
      errorMessage: errorMsg,
    });
  } finally {
    activeJobs.delete(jobId);
  }
}

async function processSingleJob(jobId: string, companyId: string | null): Promise<void> {
  if (!companyId) throw new Error("No company ID");

  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contentBlocks: { take: 20, orderBy: { order: "asc" } },
      companyTechnologies: { include: { technology: true } },
    },
  });

  if (!company) throw new Error("Company not found");

  await aiJobRepository.update(jobId, { lastHeartbeat: new Date() });

  // Build prompt context
  const icp = await icpRepository.getActive();
  const icpParsed = icpRepository.deserialize(icp);

  const ctx: PromptContext = {
    company: {
      name: company.name,
      domain: company.domain,
      website: company.website,
      description: company.description,
      industry: company.industry,
      country: company.country,
      foundedYear: company.foundedYear,
      fundingStage: company.fundingStage,
      employeeEstimate: company.employeeEstimate,
      headline: company.headline,
      pricingModel: company.pricingModel,
      pricingDetected: company.pricingDetected,
      trialDetected: company.trialDetected,
      freemiumDetected: company.freemiumDetected,
      enterpriseDetected: company.enterpriseDetected,
      callToAction: company.callToAction,
      supportEmail: company.supportEmail,
      contactEmail: company.contactEmail,
      linkedinUrl: company.linkedinUrl,
      twitterUrl: company.twitterUrl,
      websiteHttps: company.websiteHttps,
      websiteStatus: company.websiteStatus,
      websiteSpeedMs: company.websiteSpeedMs,
      enrichmentPages: company.enrichmentPages,
    },
    contentBlocks: company.contentBlocks.map((b) => ({
      pageType: b.pageType,
      blockType: b.blockType,
      heading: b.heading,
      content: b.content,
    })),
    technologies: company.companyTechnologies.map((ct) => ({
      name: ct.technology.name,
      category: ct.technology.category,
    })),
    icp: icpParsed,
  };

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(ctx);
  const promptHash = hashPrompt(systemPrompt, userPrompt);
  const websiteHash = hashWebsiteContent(ctx);
  const config = getLLMConfig();
  const cacheKey = `${companyId}:${websiteHash}:${promptHash}:${config.model}`;

  // Check cache
  const cached = await promptCacheRepository.get(cacheKey);
  if (cached) {
    logger.info("ai.worker.cacheHit", { jobId, companyId, cacheKey });
    const cachedResult = JSON.parse(cached.response) as AIAnalysisResult;
    await storeResults(companyId, cachedResult, cached.tokensUsed ?? 0, 0, promptHash, websiteHash, config.model);
    await aiJobRepository.update(jobId, { completed: 1 });
    return;
  }

  // Create analysis record
  const analysis = await aiAnalysisRepository.create(companyId, promptHash, websiteHash, config.model);

  // Call FreeLLM
  logger.info("ai.worker.callingLLM", { jobId, companyId, tokensEstimate: Math.ceil(userPrompt.length / 4) });

  const result = await callFreeLLMForJSON<AIAnalysisResult>(systemPrompt, userPrompt, {
    timeout: config.timeout,
    retries: config.retries,
    maxTokens: config.maxTokens,
  });

  // Validate
  const validation = safeValidateAIAnalysis(result.data);
  if (!validation.success) {
    throw new Error(`AI output validation failed: ${validation.error}`);
  }

  // Store results
  await storeResults(companyId, validation.data, result.tokensUsed, result.durationMs, promptHash, websiteHash, config.model);

  // Cache the response
  await promptCacheRepository.set(
    cacheKey, companyId, promptHash, websiteHash, "1.0.0", config.model,
    JSON.stringify(validation.data), result.tokensUsed
  );

  await aiJobRepository.update(jobId, { completed: 1 });

  await eventBus.emit("EnrichmentCompleted", {
    jobId,
    companyId,
    pagesCrawled: 0,
    technologiesDetected: validation.data.evidence.length,
    durationMs: result.durationMs,
    timestamp: new Date(),
  });

  logger.info("ai.worker.jobComplete", {
    jobId, companyId,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
    confidence: validation.data.overallConfidence,
    icpMatch: validation.data.icpMatch.matchPct,
  });
}

async function processBatchJob(jobId: string, batchId: string | null): Promise<void> {
  // Get all companies that need analysis (enriched but not analyzed)
  const companies = await db.company.findMany({
    where: {
      lastEnrichedAt: { not: null },
      aiAnalyses: { none: { status: "completed" } },
    },
    select: { id: true },
    take: 100, // cap at 100 per batch
  });

  await aiJobRepository.update(jobId, { total: companies.length });
  let completed = 0;
  let failed = 0;

  for (const company of companies) {
    try {
      await aiJobRepository.update(jobId, { lastHeartbeat: new Date() });
      await processSingleJob(jobId, company.id);
      completed++;
      await aiJobRepository.update(jobId, { completed });
    } catch (err) {
      failed++;
      await aiJobRepository.update(jobId, { failed });
      logger.warn("ai.worker.batchItemFailed", {
        jobId, companyId: company.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("ai.worker.batchComplete", { jobId, total: companies.length, completed, failed });
}

async function storeResults(
  companyId: string,
  result: AIAnalysisResult,
  tokensUsed: number,
  durationMs: number,
  promptHash: string,
  websiteHash: string,
  modelVersion: string
): Promise<void> {
  // Get the existing analysis record (created in processSingleJob)
  const analysis = await db.aIAnalysis.findFirst({
    where: { companyId, status: "processing" },
    orderBy: { createdAt: "desc" },
  });

  if (!analysis) {
    // Create one if it doesn't exist (e.g. from cache)
    await aiAnalysisRepository.create(companyId, promptHash, websiteHash, modelVersion);
  }

  const analysisId = analysis?.id ?? (await db.aIAnalysis.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  }))?.id;

  if (!analysisId) throw new Error("Could not get analysis ID");

  await aiAnalysisRepository.setResults(analysisId, result, tokensUsed, durationMs);
}
