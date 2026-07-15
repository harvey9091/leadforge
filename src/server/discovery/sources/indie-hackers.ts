/**
 * =============================================================================
 * Indie Hackers Source Adapter
 * =============================================================================
 *
 * Discovers companies from Indie Hackers launches and showcases.
 *
 * Indie Hackers is a community of independent founders building profitable
 * online businesses. The platform features launches, show-and-tells, and
 * side project showcases.
 *
 * Feed: https://www.indiehackers.com/launches (public RSS)
 * Auth: none required
 * Rate limit: 1 req per 3 seconds
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { parseAtomFeed, stripHtml } from "../utils/xml";

const LAUNCHES_FEED = "https://www.indiehackers.com/launches.rss";
const SOURCE_TYPE = "INDIE_HACKERS" as const;
const RATE_LIMIT_PER_SEC = 0.33;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

interface IndieHackersLaunch {
  id: string;
  title: string;
  url: string;
  description: string;
  author: string;
  publishedAt: string;
  comments: number;
}

export const indieHackersSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "Indie Hackers",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting Indie Hackers discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const result = await fetchWithRetry(LAUNCHES_FEED, {
      responseType: "text",
      maxRetries: 2,
      timeoutMs: 20_000,
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });

    if (!result.ok) {
      ctx.log("warn", `Indie Hackers feed fetch failed (${result.status})`);
      return;
    }

    const entries = parseAtomFeed(result.body as string);
    ctx.log("info", `Indie Hackers: parsed ${entries.length} entries`);
    ctx.updateProgress({ totalPages: entries.length, currentPage: 1 });

    let yielded = 0;
    for (const entry of entries) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) return;

      if (params.dateFrom || params.dateTo) {
        const published = new Date(entry.published);
        if (params.dateFrom && published < params.dateFrom) continue;
        if (params.dateTo && published > params.dateTo) continue;
      }

      if (params.keywords.length > 0) {
        const text = `${entry.title} ${entry.content ?? ""}`.toLowerCase();
        if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
      }

      const name = entry.title.replace(/^Launch:\s*/i, "").replace(/^Show:\s*/i, "").trim();

      const raw: RawCompany = {
        externalId: entry.id,
        source: SOURCE_TYPE,
        name: name || entry.title,
        description: stripHtml(entry.content ?? entry.title).slice(0, 500) || undefined,
        sourceUrl: entry.link,
        publishedAt: entry.published,
        raw: {
          title: entry.title,
          link: entry.link,
          published: entry.published,
          content: entry.content,
          author: entry.author,
        },
      };

      yielded++;
      yield raw;
    }

    ctx.log("info", `Indie Hackers discovery complete — ${yielded} companies yielded`);
  },
};
