/**
 * =============================================================================
 * Firecrawl Client + Direct HTTP Scraper Fallback
 * =============================================================================
 *
 * Dual-mode enrichment:
 *  1. If Firecrawl is configured and reachable → use Firecrawl for scraping
 *  2. Otherwise → fall back to direct HTTP fetch + HTML parsing
 *
 * Both modes produce the same `CrawledPage` shape so downstream code
 * doesn't care which mode was used.
 *
 * Configuration is loaded via the Integration Manager — never from
 * process.env directly.
 * =============================================================================
 */

import { fetchWithRetry, RateLimiter } from "@/server/discovery/http-client";
import { logger } from "@/server/utils/logger";
import { integrationManager } from "@/server/integrations/manager";

const rateLimiter = new RateLimiter(2); // 2 req/sec

export interface CrawledPage {
  url: string;
  status: number;
  ok: boolean;
  html: string;
  title?: string;
  description?: string;
  contentHash?: string;
  wordCount: number;
  fetchedAt: string;
  durationMs: number;
  redirected: boolean;
  finalUrl: string;
  contentType: string;
  /** True if this came from Firecrawl, false if direct fetch */
  fromFirecrawl: boolean;
  /** Error message if fetch failed */
  error?: string;
}

let cachedConfig: { apiUrl: string; apiKey: string; timeout: number; maxRetries: number } | null = null;
let healthChecked = false;
let healthCheckTimestamp = 0;
let firecrawlAvailable = false;
const HEALTH_CACHE_TTL_MS = 30_000;

async function getConfig(): Promise<{ apiUrl: string; apiKey: string; timeout: number; maxRetries: number }> {
  if (cachedConfig) return cachedConfig;

  const integration = integrationManager.get("firecrawl");
  if (!integration) {
    cachedConfig = {
      apiUrl: "",
      apiKey: "",
      timeout: 30000,
      maxRetries: 2,
    };
    return cachedConfig;
  }

  const config = await integration.loadConfiguration();
  cachedConfig = {
    apiUrl: config?.baseUrl ?? "",
    apiKey: config?.apiKey ?? "",
    timeout: config?.timeout ?? 30000,
    maxRetries: config?.maxRetries ?? 2,
  };
  return cachedConfig;
}

/**
 * Check if Firecrawl is available (cached after first check).
 */
export function isFirecrawlConfigured(): boolean {
  return !!cachedConfig?.apiUrl;
}

/**
 * Health check — is Firecrawl reachable?
 */
export async function checkFirecrawlHealth(): Promise<{
  available: boolean;
  latencyMs?: number;
  version?: string;
  error?: string;
}> {
  const config = await getConfig();
  if (!config.apiUrl) {
    return { available: false, error: "Firecrawl URL not configured" };
  }

  const now = Date.now();
  if (healthChecked && now - healthCheckTimestamp < HEALTH_CACHE_TTL_MS) {
    return { available: firecrawlAvailable };
  }

  const start = performance.now();
  try {
    const result = await fetchWithRetry(`${config.apiUrl}/v1/health`, {
      timeoutMs: 5000,
      maxRetries: 1,
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    });
    const latencyMs = Math.round(performance.now() - start);
    firecrawlAvailable = result.ok;
    healthChecked = true;
    healthCheckTimestamp = now;

    let version: string | undefined;
    if (result.ok) {
      try {
        const body = result.body as { version?: string; data?: { version?: string } };
        version = body.version ?? body.data?.version ?? "unknown";
      } catch {
        version = "unknown";
      }
    }

    return {
      available: result.ok,
      latencyMs,
      version,
    };
  } catch (err) {
    firecrawlAvailable = false;
    healthChecked = true;
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Crawl a single URL. Uses Firecrawl if available, otherwise direct fetch.
 */
export async function crawlPage(url: string): Promise<CrawledPage> {
  await rateLimiter.wait();

  const config = await getConfig();
  if (config.apiUrl && firecrawlAvailable) {
    try {
      return await crawlWithFirecrawl(url, config);
    } catch (err) {
      logger.warn("enrichment.firecrawl.fallback", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return crawlDirect(url);
}

/**
 * Crawl using Firecrawl's /v1/scrape endpoint.
 */
async function crawlWithFirecrawl(url: string, config: { apiUrl: string; apiKey: string; timeout: number; maxRetries: number }): Promise<CrawledPage> {
  const start = performance.now();
  const result = await fetchWithRetry(`${config.apiUrl}/v1/scrape`, {
    method: "POST",
    timeoutMs: config.timeout,
    maxRetries: config.maxRetries,
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: {
      url,
      formats: ["html", "markdown"],
      onlyMainContent: false,
    },
  });

  const durationMs = Math.round(performance.now() - start);

  if (!result.ok) {
    throw new Error(`Firecrawl returned ${result.status}`);
  }

  const body = result.body as {
    data?: {
      html?: string;
      markdown?: string;
      metadata?: {
        title?: string;
        description?: string;
        sourceURL?: string;
        statusCode?: number;
      };
    };
    success?: boolean;
  };

  const html = body.data?.html ?? "";
  const title = body.data?.metadata?.title;
  const description = body.data?.metadata?.description;
  const finalUrl = body.data?.metadata?.sourceURL ?? url;
  const status = body.data?.metadata?.statusCode ?? 200;

  return {
    url,
    status,
    ok: true,
    html,
    title,
    description,
    wordCount: countWords(stripHtml(html)),
    fetchedAt: new Date().toISOString(),
    durationMs,
    redirected: finalUrl !== url,
    finalUrl,
    contentType: "text/html",
    fromFirecrawl: true,
    contentHash: hashContent(html),
  };
}

/**
 * Direct HTTP fetch — the fallback when Firecrawl isn't available.
 * Still fetches real websites — no mock data.
 */
async function crawlDirect(url: string): Promise<CrawledPage> {
  const start = performance.now();
  const result = await fetchWithRetry(url, {
    timeoutMs: 20_000,
    maxRetries: 2,
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
  });

  const durationMs = Math.round(performance.now() - start);

  if (!result.ok) {
    return {
      url,
      status: result.status,
      ok: false,
      html: "",
      wordCount: 0,
      fetchedAt: new Date().toISOString(),
      durationMs,
      redirected: result.url !== url,
      finalUrl: result.url,
      contentType: "text/html",
      fromFirecrawl: false,
      error: result.error,
    };
  }

  const html = (result.body as string) ?? "";
  const cappedHtml = html.length > 500_000 ? html.slice(0, 500_000) : html;
  const { title, description } = extractMeta(cappedHtml);

  return {
    url,
    status: result.status,
    ok: true,
    html: cappedHtml,
    title,
    description,
    wordCount: countWords(stripHtml(cappedHtml)),
    fetchedAt: new Date().toISOString(),
    durationMs,
    redirected: result.url !== url,
    finalUrl: result.url,
    contentType: result.headers["content-type"] ?? "text/html",
    fromFirecrawl: false,
    contentHash: hashContent(cappedHtml),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function extractMeta(html: string): { title?: string; description?: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);

  return {
    title: titleMatch?.[1]?.trim(),
    description: descMatch?.[1]?.trim(),
  };
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Sanitize HTML — prevent XSS. Removes script tags, event handlers,
 * and dangerous attributes. Used before storing content.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

/**
 * Validate a URL — reject malformed URLs and non-HTTP schemes.
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
