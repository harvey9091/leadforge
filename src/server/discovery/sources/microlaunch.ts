/**
 * =============================================================================
 * MicroLaunch Source Adapter
 * =============================================================================
 *
 * Discovers companies from MicroLaunch launches feed.
 *
 * MicroLaunch is a platform for micro-startups and small launches.
 * It features early-stage products, side projects, and indie startups.
 *
 * Feed: https://microlaunch.net/launches (public RSS)
 * Auth: none required
 * Rate limit: 1 req per 3 seconds
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { parseAtomFeed, stripHtml } from "../utils/xml";

const LAUNCHES_FEED = "https://microlaunch.net/launches";
const SOURCE_TYPE = "MICROLAUNCH" as const;
const RATE_LIMIT_PER_SEC = 0.33;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

interface MicroLaunch {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  author: string;
  votes: number;
}

export const microLaunchSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "MicroLaunch",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting MicroLaunch discovery");
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
      ctx.log("warn", `MicroLaunch feed fetch failed (${result.status})`);
      return;
    }

    const entries = parseAtomFeed(result.body as string);
    ctx.log("info", `MicroLaunch: parsed ${entries.length} entries`);
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

      const name = entry.title.replace(/^Launch:\s*/i, "").trim();

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

    ctx.log("info", `MicroLaunch discovery complete — ${yielded} companies yielded`);
  },
};
