/**
 * =============================================================================
 * Hacker News — Show HN Source Adapter
 * =============================================================================
 *
 * Discovers companies from "Show HN" posts on Hacker News via the Algolia
 * HN Search API (https://hn.algolia.com/api).
 *
 * Show HN posts are where founders launch their products/projects. Each
 * post with a URL points to a real product website — that's our company.
 *
 * API: https://hn.algolia.com/api/v1/search_by_date?tags=show_hn
 * Auth: none required
 * Rate limit: unofficial, ~1 req/sec is safe
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { logger } from "@/server/utils/logger";

const API_BASE = "https://hn.algolia.com/api/v1/search_by_date";
const SOURCE_TYPE = "HACKER_NEWS" as const;
const RATE_LIMIT_PER_SEC = 1; // 1 req/sec to be safe

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

interface HnHit {
  objectID: string;
  title: string;
  url?: string | null;
  story_text?: string | null;
  points?: number;
  author?: string;
  created_at?: string;
  num_comments?: number;
  _tags?: string[];
}

interface HnResponse {
  hits: HnHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

export const hackerNewsSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "Hacker News (Show HN)",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    const tags = ["show_hn"];
    // Build search query from keywords
    let query: string | undefined;
    if (params.keywords.length > 0) {
      query = params.keywords.join(" ");
    }

    let page = 0;
    let totalYielded = 0;
    const minPoints = 3; // filter out low-quality posts

    ctx.log("info", `Starting HN Show HN discovery (query: ${query ?? "none"}, min points: ${minPoints})`);

    while (page < params.maxPages) {
      if (!ctx.shouldContinue()) {
        ctx.log("info", "HN discovery cancelled");
        return;
      }

      await rateLimiter.wait();

      const url = new URL(API_BASE);
      url.searchParams.set("tags", tags.join(","));
      url.searchParams.set("hitsPerPage", String(this.defaultPageSize));
      url.searchParams.set("page", String(page));
      if (query) url.searchParams.set("query", query);

      // Date range filter
      if (params.dateFrom) {
        url.searchParams.set("numericFilters", `created_at_i>=${Math.floor(params.dateFrom.getTime() / 1000)}`);
      }
      if (params.dateTo) {
        const existing = url.searchParams.get("numericFilters");
        const toFilter = `created_at_i<=${Math.floor(params.dateTo.getTime() / 1000)}`;
        url.searchParams.set("numericFilters", existing ? `${existing},${toFilter}` : toFilter);
      }

      ctx.updateProgress({ currentSource: this.label, currentPage: page + 1 });

      const result = await fetchWithRetry(url.toString(), {
        responseType: "json",
        maxRetries: 3,
        timeoutMs: 15_000,
      });

      if (!result.ok) {
        await ctx.log("error", `HN API request failed: ${result.error}`, { status: result.status, page });
        await ctx.updateProgress({ currentSource: this.label });
        await ctx.sleep(2000);
        page++;
        continue;
      }

      const data = result.body as HnResponse;
      if (!data.hits || data.hits.length === 0) {
        ctx.log("info", `HN: no more results at page ${page}`);
        break;
      }

      ctx.updateProgress({ totalPages: data.nbPages });

      for (const hit of data.hits) {
        if (!ctx.shouldContinue()) return;
        if (totalYielded >= params.maxCompanies) {
          ctx.log("info", `HN: reached maxCompanies limit (${params.maxCompanies})`);
          return;
        }

        // Filter: minimum points (quality signal)
        if ((hit.points ?? 0) < minPoints) continue;

        // Must have a URL (external link = product website)
        // HN posts with url=null are text posts (Ask HN, Tell HN) — skip
        if (!hit.url) continue;

        // Skip GitHub/generic repo links — we want product websites
        const lowerUrl = hit.url.toLowerCase();
        if (lowerUrl.includes("github.com/") && !lowerUrl.includes("github.io")) continue;
        if (lowerUrl.includes("gist.github.com")) continue;
        if (lowerUrl.startsWith("https://news.ycombinator.com")) continue;

        const title = hit.title?.replace(/^Show HN:\s*/i, "").trim();
        if (!title) continue;

        const raw: RawCompany = {
          externalId: hit.objectID,
          source: SOURCE_TYPE,
          name: title,
          website: hit.url,
          description: stripHtml(hit.story_text).slice(0, 500) || undefined,
          sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          publishedAt: hit.created_at,
          raw: {
            title: hit.title,
            url: hit.url,
            points: hit.points,
            author: hit.author,
            created_at: hit.created_at,
            num_comments: hit.num_comments,
            objectID: hit.objectID,
          },
        };

        totalYielded++;
        yield raw;
      }

      ctx.log("info", `HN: page ${page + 1}/${data.nbPages} — ${data.hits.length} hits, ${totalYielded} yielded`);

      page++;

      if (page >= data.nbPages) {
        ctx.log("info", `HN: reached end of results (${data.nbPages} pages)`);
        break;
      }
    }

    ctx.log("info", `HN discovery complete — ${totalYielded} companies yielded`);
  },
};

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}
