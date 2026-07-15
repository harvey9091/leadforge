/**
 * =============================================================================
 * Product Hunt Source Adapter
 * =============================================================================
 *
 * Discovers companies from Product Hunt's public RSS/Atom feed.
 *
 * Product Hunt is a daily collection of new products. Each entry in the
 * feed is a real product launch with a name, description, and link.
 *
 * Feed URL: https://www.producthunt.com/feed (Atom XML)
 * Auth: none required
 * Rate limit: unofficial, 1 req per few seconds is safe
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { parseAtomFeed, stripHtml } from "../utils/xml";

const FEED_URL = "https://www.producthunt.com/feed";
const SOURCE_TYPE = "PRODUCT_HUNT" as const;
const RATE_LIMIT_PER_SEC = 0.5; // 1 req per 2 sec

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

interface AtomEntry {
  id: string;
  title: string;
  link: string;
  published: string;
  updated?: string;
  content?: string;
  summary?: string;
  author?: string;
}

export const productHuntSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "Product Hunt",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting Product Hunt discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1, totalPages: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const result = await fetchWithRetry(FEED_URL, {
      responseType: "text",
      maxRetries: 3,
      timeoutMs: 20_000,
      headers: { Accept: "application/atom+xml, application/xml, text/xml" },
    });

    if (!result.ok) {
      ctx.log("error", `Product Hunt feed fetch failed: ${result.error}`, { status: result.status });
      ctx.updateProgress({ errorsCount: 1 });
      return;
    }

    const xml = result.body as string;
    const entries = parseAtomFeed(xml);

    ctx.log("info", `Product Hunt: parsed ${entries.length} entries`);
    ctx.updateProgress({ totalPages: 1, currentPage: 1 });

    let yielded = 0;
    for (const entry of entries) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) {
        ctx.log("info", `Product Hunt: reached maxCompanies limit (${params.maxCompanies})`);
        return;
      }

      // Apply date filter
      if (params.dateFrom || params.dateTo) {
        const published = new Date(entry.published);
        if (params.dateFrom && published < params.dateFrom) continue;
        if (params.dateTo && published > params.dateTo) continue;
      }

      // Apply keyword filter
      if (params.keywords.length > 0) {
        const text = `${entry.title} ${entry.content ?? ""}`.toLowerCase();
        const matches = params.keywords.some((k) => text.includes(k.toLowerCase()));
        if (!matches) continue;
      }

      // Extract the actual product website from the content
      const website = extractProductWebsite(entry.content ?? "");
      const productUrl = entry.link;

      // The "link" is a producthunt.com/products/... URL — we want the real website
      const actualWebsite = website || productUrl;

      const raw: RawCompany = {
        externalId: entry.id,
        source: SOURCE_TYPE,
        name: entry.title.trim(),
        website: actualWebsite,
        description: stripHtml(entry.content ?? entry.summary ?? "").slice(0, 500) || undefined,
        sourceUrl: productUrl,
        publishedAt: entry.published,
        raw: {
          title: entry.title,
          link: entry.link,
          published: entry.published,
          content: entry.content,
        },
      };

      yielded++;
      yield raw;
    }

    ctx.log("info", `Product Hunt discovery complete — ${yielded} companies yielded`);
  },
};

function extractProductWebsite(content: string): string | undefined {
  // Look for the product website link (not a producthunt.com link)
  const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[1]!;
    if (!url.includes("producthunt.com") && !url.includes("utm_campaign")) {
      return url;
    }
  }
  return undefined;
}


