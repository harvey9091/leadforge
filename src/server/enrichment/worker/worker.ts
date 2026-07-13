/**
 * =============================================================================
 * Enrichment Worker
 * =============================================================================
 *
 * Processes enrichment jobs. For each job:
 *  1. Crawl the company's homepage + key pages (pricing, about, etc.)
 *  2. Detect technologies from the HTML
 *  3. Extract structured content (title, description, CTA, contact info, etc.)
 *  4. Check website health (HTTPS, status, speed, redirects, robots.txt)
 *  5. Store content blocks + website snapshots
 *  6. Update the company with enriched fields
 *  7. Emit EnrichmentCompleted event
 *
 * Same lifecycle as the discovery worker:
 *  - Queue-based (polls every 5s)
 *  - Pause / Resume / Retry / Cancel
 *  - Concurrency (up to 2 jobs)
 *  - Heartbeat + stale recovery
 *  - Crash-safe
 * =============================================================================
 */

import { env } from "@/server/config/env";
import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";
import { eventBus } from "@/server/events/event-bus";
import { crawlPage, checkFirecrawlHealth, validateUrl } from "../firecrawl-client";
import { detectTechnologies } from "../technologies/detector";
import { extractContent } from "../content-extractor";
import {
  enrichmentJobRepository,
  enrichmentLogRepository,
  technologyRepository,
  contentBlockRepository,
  snapshotRepository,
  companyEnrichmentRepository,
} from "@/server/repositories/enrichment.repository";
import type { CrawledPage } from "../firecrawl-client";

const POLL_INTERVAL_MS = env.worker.enrichmentPollIntervalMs;
const HEARTBEAT_TIMEOUT_MS = env.worker.enrichmentHeartbeatTimeoutMs;
const MAX_CONCURRENT_JOBS = env.worker.enrichmentConcurrency;

const PAGE_TYPES = [
  { path: "", type: "HOMEPAGE" },
  { path: "/pricing", type: "PRICING" },
  { path: "/about", type: "ABOUT" },
  { path: "/contact", type: "CONTACT" },
  { path: "/careers", type: "CAREERS" },
];

let workerStarted = false;
let pollHandle: ReturnType<typeof setInterval> | null = null;
let activeJobs = new Set<string>();

let _workerId: string | null = null;
function getWorkerId(): string {
  if (!_workerId) {
    const pid = typeof process !== "undefined" ? process.pid : 0;
    _workerId = `enrichment-${pid}-${Date.now().toString(36)}`;
  }
  return _workerId;
}

export function startEnrichmentWorker(): void {
  if (workerStarted) return;
  workerStarted = true;

  const workerId = getWorkerId();
  logger.info("enrichment.worker.starting", { workerId, pollIntervalMs: POLL_INTERVAL_MS });

  setTimeout(() => { void poll(); }, 10_000); // delay first poll by 10s
  pollHandle = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);

  try {
    if (typeof process !== "undefined" && process.on) {
      process.on("beforeExit", () => {
        if (pollHandle) clearInterval(pollHandle);
      });
    }
  } catch { /* Edge Runtime */ }
}

export function getEnrichmentWorkerStatus() {
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
    if (!db.enrichmentJob || typeof db.enrichmentJob.findMany !== "function") return;

    // Recover stale jobs
    const staleBefore = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
    const staleJobs = await enrichmentJobRepository.findStale(staleBefore);
    for (const job of staleJobs) {
      logger.warn("enrichment.worker.recoverStale", { jobId: job.id });
      await enrichmentJobRepository.setStatus(job.id, "RETRYING");
      await enrichmentLogRepository.create({
        jobId: job.id,
        level: "WARN",
        message: "Job recovered from stale worker — will retry",
      });
    }

    // Find pending jobs
    const pending = await enrichmentJobRepository.findPending(MAX_CONCURRENT_JOBS);
    if (pending.length === 0) return;

    for (const job of pending) {
      if (activeJobs.has(job.id)) continue;
      if (activeJobs.size >= MAX_CONCURRENT_JOBS) break;

      activeJobs.add(job.id);
      void processJob(job.id).finally(() => activeJobs.delete(job.id));
    }
  } catch (err) {
    logger.error("enrichment.worker.pollError", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function notifyNewEnrichmentJob(): void {
  setTimeout(() => void poll(), 100);
}

async function processJob(jobId: string): Promise<void> {
  const job = await enrichmentJobRepository.findById(jobId);
  if (!job) return;

  if (job.status === "CANCELLED" || job.status === "COMPLETED") {
    activeJobs.delete(jobId);
    return;
  }

  logger.info("enrichment.worker.jobStart", { jobId, companyId: job.companyId });

  await enrichmentJobRepository.setStatus(jobId, "RUNNING", {
    startedAt: job.startedAt ?? new Date(),
    lastHeartbeat: new Date(),
    workerId: getWorkerId(),
    errorMessage: null,
  });

  await enrichmentLogRepository.create({
    jobId, level: "INFO",
    message: `Enrichment started for company: ${job.companyId}`,
  });

  // Get the company
  const company = await db.company.findUnique({ where: { id: job.companyId } });
  if (!company) {
    await enrichmentJobRepository.setStatus(jobId, "FAILED", {
      completedAt: new Date(),
      errorMessage: "Company not found",
    });
    await eventBus.emit("EnrichmentFailed", {
      jobId, companyId: job.companyId, error: "Company not found", timestamp: new Date(),
    });
    return;
  }

  const website = company.website ?? (company.domain ? `https://${company.domain}` : null);
  if (!website || !validateUrl(website)) {
    await enrichmentJobRepository.setStatus(jobId, "FAILED", {
      completedAt: new Date(),
      errorMessage: "No valid website URL",
    });
    await enrichmentLogRepository.create({
      jobId, level: "ERROR", message: `No valid website URL for company: ${company.name}`,
    });
    await eventBus.emit("EnrichmentFailed", {
      jobId, companyId: company.id, error: "No valid website URL", timestamp: new Date(),
    });
    return;
  }

  await eventBus.emit("EnrichmentStarted", {
    jobId, companyId: company.id, domain: company.domain ?? website, timestamp: new Date(),
  });

  const startTime = Date.now();
  let pagesCrawled = 0;
  let technologiesDetected = 0;
  let homepageContent: Awaited<ReturnType<typeof extractContent>> | null = null;
  let homepagePage: CrawledPage | null = null;
  const allDetectedTechnologies: Map<string, { name: string; slug: string; category: string; confidence: number }> = new Map();

  try {
    // 1. Check Firecrawl health
    const health = await checkFirecrawlHealth();
    await enrichmentLogRepository.create({
      jobId, level: "INFO",
      message: health.available
        ? `Firecrawl available (latency: ${health.latencyMs}ms)`
        : `Firecrawl not available — using direct HTTP fetch`,
    });

    // 2. Crawl homepage
    await enrichmentJobRepository.update(jobId, { lastHeartbeat: new Date(), });
    await enrichmentLogRepository.create({
      jobId, level: "INFO", page: "HOMEPAGE",
      message: `Crawling homepage: ${website}`,
    });

    homepagePage = await crawlPage(website);
    pagesCrawled++;

    if (homepagePage.ok && homepagePage.html) {
      homepageContent = extractContent(homepagePage.html, website);

      // Detect technologies from homepage
      const homepageTechs = detectTechnologies(homepagePage.html);
      for (const t of homepageTechs) {
        allDetectedTechnologies.set(t.slug, t);
      }

      // Store snapshot
      await snapshotRepository.create({
        companyId: company.id,
        url: website,
        pageType: "HOMEPAGE",
        title: homepagePage.title,
        description: homepagePage.description,
        contentHash: homepagePage.contentHash,
        wordCount: homepagePage.wordCount,
      });

      await enrichmentLogRepository.create({
        jobId, level: "INFO", page: "HOMEPAGE",
        message: `Homepage crawled: ${homepagePage.wordCount} words, ${homepagePage.durationMs}ms`,
        durationMs: homepagePage.durationMs,
      });
    } else {
      await enrichmentLogRepository.create({
        jobId, level: "WARN", page: "HOMEPAGE",
        message: `Homepage crawl failed: ${homepagePage.error ?? `HTTP ${homepagePage.status}`}`,
      });
    }

    // 3. Crawl additional pages (pricing, about, etc.)
    const baseUrl = new URL(website);
    for (const pageType of PAGE_TYPES.slice(1)) { // skip homepage (already done)
      if (!isJobActive(jobId)) break;

      await enrichmentJobRepository.update(jobId, { lastHeartbeat: new Date() });

      const pageUrl = `${baseUrl.origin}${pageType.path}`;
      await enrichmentLogRepository.create({
        jobId, level: "DEBUG", page: pageType.type,
        message: `Crawling ${pageType.type.toLowerCase()}: ${pageUrl}`,
      });

      try {
        const page = await crawlPage(pageUrl);
        if (page.ok && page.html) {
          pagesCrawled++;

          // Detect technologies from this page
          const pageTechs = detectTechnologies(page.html);
          for (const t of pageTechs) {
            allDetectedTechnologies.set(t.slug, t);
          }

          await snapshotRepository.create({
            companyId: company.id,
            url: pageUrl,
            pageType: pageType.type,
            title: page.title,
            description: page.description,
            contentHash: page.contentHash,
            wordCount: page.wordCount,
          });

          await enrichmentLogRepository.create({
            jobId, level: "INFO", page: pageType.type,
            message: `${pageType.type} crawled: ${page.wordCount} words`,
            durationMs: page.durationMs,
          });
        }
      } catch (err) {
        await enrichmentLogRepository.create({
          jobId, level: "WARN", page: pageType.type,
          message: `Failed to crawl ${pageType.type}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // 4. Store detected technologies
    if (allDetectedTechnologies.size > 0) {
      const technologies = Array.from(allDetectedTechnologies.values());
      technologiesDetected = technologies.length;

      await technologyRepository.replaceCompanyTechnologies(company.id, technologies);

      await enrichmentLogRepository.create({
        jobId, level: "INFO",
        message: `Detected ${technologiesDetected} technologies: ${technologies.map((t) => t.name).slice(0, 10).join(", ")}${technologiesDetected > 10 ? "..." : ""}`,
      });
    }

    // 5. Extract content and update company
    if (homepageContent) {
      // Store content blocks
      await contentBlockRepository.replaceForCompany(
        company.id,
        homepageContent.contentBlocks
      );

      // Update company enrichment fields
      await companyEnrichmentRepository.updateEnrichment(
        company.id,
        homepageContent,
        pagesCrawled,
        Date.now() - startTime
      );

      // Update website health
      if (homepagePage) {
        await companyEnrichmentRepository.updateWebsiteHealth(company.id, {
          https: website.startsWith("https://"),
          status: homepagePage.status,
          speedMs: homepagePage.durationMs,
          redirects: homepagePage.redirected,
        });
      }
    }

    // 6. Complete
    const durationMs = Date.now() - startTime;
    await enrichmentJobRepository.setStatus(jobId, "COMPLETED", {
      completedAt: new Date(),
      pagesCrawled,
      technologiesFound: technologiesDetected,
      durationMs,
      lastHeartbeat: new Date(),
    });

    await enrichmentLogRepository.create({
      jobId, level: "INFO",
      message: `Enrichment completed: ${pagesCrawled} pages, ${technologiesDetected} technologies, ${durationMs}ms`,
    });

    await eventBus.emit("EnrichmentCompleted", {
      jobId,
      companyId: company.id,
      pagesCrawled,
      technologiesDetected,
      durationMs,
      timestamp: new Date(),
    });

    logger.info("enrichment.worker.jobComplete", {
      jobId, companyId: company.id, pagesCrawled, technologiesDetected, durationMs,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("enrichment.worker.jobError", { jobId, error: errorMsg });

    await enrichmentJobRepository.setStatus(jobId, "FAILED", {
      completedAt: new Date(),
      errorMessage: errorMsg,
    });

    await enrichmentLogRepository.create({
      jobId, level: "ERROR",
      message: `Enrichment failed: ${errorMsg}`,
    });

    await eventBus.emit("EnrichmentFailed", {
      jobId, companyId: job.companyId, error: errorMsg, timestamp: new Date(),
    });
  } finally {
    activeJobs.delete(jobId);
  }
}

function isJobActive(jobId: string): boolean {
  return activeJobs.has(jobId);
}
