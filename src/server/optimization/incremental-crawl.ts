/**
 * =============================================================================
 * Incremental Crawling Engine — Phase 6
 * =============================================================================
 *
 * Avoids repeatedly crawling unchanged data. Tracks ETags, Last-Modified
 * headers, and content hashes to determine if a page needs recrawling.
 *
 * Each URL has a CrawlState record:
 *  - etag / lastModified — HTTP cache headers
 *  - contentHash — hash of page content
 *  - lastCrawledAt — when the page was last fetched
 *  - changeCount / lastChangedAt — how often the page changes
 *  - avgChangeFrequencyHours — estimated change frequency
 *
 * The engine decides whether to recrawl based on:
 *  1. Has the page changed since last crawl? (ETag / content hash)
 *  2. Is the estimated change frequency exceeded?
 *  3. Has the user explicitly requested a full recrawl?
 * =============================================================================
 */

import { db } from "@/lib/db";
import { createHash } from "node:crypto";

export interface CrawlStateData {
  url: string;
  etag: string | null;
  lastModified: string | null;
  contentHash: string | null;
  lastCrawledAt: Date | null;
  crawlCount: number;
  changeCount: number;
  lastChangedAt: Date | null;
  avgChangeFrequencyHours: number;
}

/**
 * Get the crawl state for a URL.
 */
export async function getCrawlState(url: string): Promise<CrawlStateData | null> {
  const state = await db.crawlState.findUnique({ where: { url } });
  if (!state) return null;
  return state as unknown as CrawlStateData;
}

/**
 * Determine if a URL should be recrawled.
 *
 * @param url The URL to check
 * @param force If true, always return true (explicit recrawl request)
 * @returns true if the page should be crawled, false if it's likely unchanged
 */
export async function shouldCrawl(url: string, force: boolean = false): Promise<boolean> {
  if (force) return true;

  const state = await getCrawlState(url);
  if (!state || !state.lastCrawledAt) return true; // never crawled

  // Check if enough time has passed based on change frequency
  const hoursSinceLastCrawl = (Date.now() - state.lastCrawledAt.getTime()) / (1000 * 60 * 60);

  // If the page changes frequently (every few hours), recrawl if enough time passed
  // If the page rarely changes (monthly+), don't recrawl unless 7+ days passed
  const minIntervalHours = Math.min(state.avgChangeFrequencyHours * 0.5, 168); // max 1 week

  return hoursSinceLastCrawl >= minIntervalHours;
}

/**
 * Update crawl state after a successful crawl.
 * Detects if the content has changed and updates the change frequency.
 */
export async function recordCrawl(
  url: string,
  content: string,
  headers: { etag?: string; lastModified?: string },
  companyId?: string,
  sourceType?: string
): Promise<{ changed: boolean; state: CrawlStateData }> {
  const contentHash = hashContent(content);
  const existing = await getCrawlState(url);
  const changed = !existing || existing.contentHash !== contentHash;

  let newChangeCount = existing?.changeCount ?? 0;
  let lastChangedAt = existing?.lastChangedAt ?? null;
  let avgChangeFreq = existing?.avgChangeFrequencyHours ?? 168;

  if (changed) {
    newChangeCount++;
    lastChangedAt = new Date();

    // Update average change frequency
    if (existing?.lastCrawledAt && existing.crawlCount > 0) {
      const hoursSinceLastCrawl = (Date.now() - existing.lastCrawledAt.getTime()) / (1000 * 60 * 60);
      // Exponential moving average
      avgChangeFreq = existing.avgChangeFrequencyHours * 0.7 + hoursSinceLastCrawl * 0.3;
    }
  }

  const state = await db.crawlState.upsert({
    where: { url },
    create: {
      url,
      companyId,
      sourceType,
      etag: headers.etag ?? null,
      lastModified: headers.lastModified ?? null,
      contentHash,
      lastCrawledAt: new Date(),
      crawlCount: 1,
      changeCount: newChangeCount,
      lastChangedAt,
      avgChangeFrequencyHours: avgChangeFreq,
    },
    update: {
      companyId,
      sourceType,
      etag: headers.etag ?? null,
      lastModified: headers.lastModified ?? null,
      contentHash,
      lastCrawledAt: new Date(),
      crawlCount: { increment: 1 },
      changeCount: newChangeCount,
      lastChangedAt,
      avgChangeFrequencyHours: avgChangeFreq,
    },
  });

  return { changed, state: state as unknown as CrawlStateData };
}

/**
 * Get crawl statistics for the system page.
 */
export async function getCrawlStats(): Promise<{
  totalUrls: number;
  totalCrawls: number;
  totalChanges: number;
  avgChangeFrequency: number;
  recentlyCrawled: number;
}> {
  const [totalUrls, recentCrawls, states] = await Promise.all([
    db.crawlState.count(),
    db.crawlState.count({
      where: { lastCrawledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    db.crawlState.findMany({
      select: { crawlCount: true, changeCount: true, avgChangeFrequencyHours: true },
      take: 10000,
    }),
  ]);

  const totalCrawls = states.reduce((sum, s) => sum + s.crawlCount, 0);
  const totalChanges = states.reduce((sum, s) => sum + s.changeCount, 0);
  const avgChangeFreq = states.length > 0
    ? states.reduce((sum, s) => sum + s.avgChangeFrequencyHours, 0) / states.length
    : 0;

  return {
    totalUrls,
    totalCrawls,
    totalChanges,
    avgChangeFrequency: avgChangeFreq,
    recentlyCrawled: recentCrawls,
  };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}
