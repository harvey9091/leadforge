/**
 * =============================================================================
 * BetaList Source Adapter
 * =============================================================================
 *
 * Discovers companies from BetaList via their public ATOM feed.
 *
 * Feed URL: https://feeds.feedburner.com/BetaList
 * Auth: none required
 * Rate limit: unofficial, 1 req per 2 seconds is safe
 *
 * Each entry contains: title (with company name), description,
 * publication date, and link to the BetaList startup page.
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { parseAtomFeed, stripHtml, type AtomEntry } from "../utils/xml";

const FEED_URL = "https://feeds.feedburner.com/BetaList";
const SOURCE_TYPE = "BETALIST" as const;
const RATE_LIMIT_PER_SEC = 0.5;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

export const betaListSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "BetaList",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting BetaList discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const result = await fetchWithRetry(FEED_URL, {
      responseType: "text",
      maxRetries: 3,
      timeoutMs: 20_000,
      headers: { Accept: "application/atom+xml, application/xml, text/xml" },
    });

    if (!result.ok) {
      ctx.log("error", `BetaList feed fetch failed: ${result.error}`, { status: result.status });
      ctx.updateProgress({ errorsCount: 1 });
      return;
    }

    const xml = result.body as string;
    const entries = parseBetaListAtomFeed(xml);

    ctx.log("info", `BetaList: parsed ${entries.length} feed entries`);
    ctx.updateProgress({ totalPages: 1, currentPage: 1 });

    let yielded = 0;
    for (const entry of entries) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) {
        ctx.log("info", `BetaList: reached maxCompanies limit (${params.maxCompanies})`);
        return;
      }

      if (params.dateFrom || params.dateTo) {
        const published = new Date(entry.published);
        if (params.dateFrom && published < params.dateFrom) continue;
        if (params.dateTo && published > params.dateTo) continue;
      }

      if (params.keywords.length > 0) {
        const text = `${entry.title} ${entry.content ?? ""}`.toLowerCase();
        if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
      }

      const { name, description } = parseBetaListTitle(entry.title);
      const cleanContent = stripHtml(entry.content ?? "").slice(0, 500);

      const slugMatch = entry.link.match(/\/startups\/([a-z0-9-]+)/i);
      const slug = slugMatch?.[1];

      const raw: RawCompany = {
        externalId: entry.id,
        source: SOURCE_TYPE,
        name,
        description: description || cleanContent || undefined,
        sourceUrl: entry.link,
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

    ctx.log("info", `BetaList discovery complete — ${yielded} companies yielded`);
  },
};

function parseBetaListAtomFeed(xml: string): AtomEntry[] {
  return parseAtomFeed(xml);
}

function parseBetaListTitle(title: string): { name: string; description: string } {
  const emDashMatch = title.match(/^(.+?)\s+[–—-]\s+(.+)$/);
  if (emDashMatch) {
    return { name: emDashMatch[1]!.trim(), description: emDashMatch[2]!.trim() };
  }
  return { name: title.trim(), description: "" };
}
