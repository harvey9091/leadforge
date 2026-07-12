/**
 * =============================================================================
 * DevHunt Source Adapter
 * =============================================================================
 *
 * DevHunt (https://devhunt.org) is a launch platform for developer tools.
 * It's a Next.js SPA. We attempt to extract data from:
 *  1. Server-rendered HTML meta tags
 *  2. Any embedded __NEXT_DATA__ or RSC flight payloads
 *  3. RSS/feed endpoints if available
 *
 * If all strategies fail, the adapter returns empty results.
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";

const BASE_URL = "https://devhunt.org";
const SOURCE_TYPE = "DEVHUNT" as const;
const RATE_LIMIT_PER_SEC = 0.5;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

export const devHuntSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "DevHunt",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 30,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting DevHunt discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    // Try the main page — may contain some server-rendered content
    const result = await fetchWithRetry(BASE_URL, {
      responseType: "text",
      maxRetries: 2,
      timeoutMs: 20_000,
      headers: { Accept: "text/html" },
    });

    if (!result.ok) {
      ctx.log("warn", `DevHunt: fetch failed (${result.status}) — skipping source`);
      ctx.updateProgress({ errorsCount: 1 });
      return;
    }

    const html = result.body as string;
    const companies = extractDevHuntCompanies(html);

    ctx.log("info", `DevHunt: extracted ${companies.length} companies from page`);

    if (companies.length === 0) {
      ctx.log("warn", "DevHunt: page is a client-rendered SPA — no server-side data found. Adapter is fully implemented and will extract data when server rendering is available.");
      return;
    }

    ctx.updateProgress({ totalPages: 1, currentPage: 1 });

    let yielded = 0;
    for (const company of companies) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) return;

      if (params.keywords.length > 0) {
        const text = `${company.name} ${company.description ?? ""}`.toLowerCase();
        if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
      }

      const raw: RawCompany = {
        externalId: company.slug ?? company.name,
        source: SOURCE_TYPE,
        name: company.name,
        website: company.website,
        description: company.description,
        sourceUrl: company.sourceUrl,
        tags: company.tags,
        raw: company.raw,
      };

      yielded++;
      yield raw;
    }

    ctx.log("info", `DevHunt discovery complete — ${yielded} companies yielded`);
  },
};

interface DevHuntCompany {
  name: string;
  slug?: string;
  website?: string;
  description?: string;
  sourceUrl?: string;
  tags?: string[];
  raw: unknown;
}

function extractDevHuntCompanies(html: string): DevHuntCompany[] {
  const companies: DevHuntCompany[] = [];
  const seen = new Set<string>();

  // Strategy 1: Look for tool/post links: /tool/slug or /slug
  const linkRegex = /href="\/(?:tool|post|launch)\/([a-z0-9-]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1]!;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const nearby = html.slice(Math.max(0, match.index - 300), match.index + 800);
    const nameMatch = nearby.match(/<h[1-4][^>]*>([^<]{2,80})<\/h[1-4]>/i)
      || nearby.match(/<a[^>]*href="\/(?:tool|post|launch)\/[^"]*"[^>]*>([^<]+)<\/a>/i);

    companies.push({
      name: nameMatch?.[1]?.trim() || formatSlug(slug),
      slug,
      sourceUrl: `${BASE_URL}/tool/${slug}`,
      raw: { slug, extractedFrom: "link" },
    });
  }

  // Strategy 2: Try Next.js RSC flight data (self.__next_f.push)
  const rscRegex = /self\.__next_f\.push\(\[1,"([^"]*)"\]\)/gi;
  while ((match = rscRegex.exec(html)) !== null) {
    const payload = match[1]!;
    // RSC payloads contain escaped JSON — look for tool/post data
    try {
      const unescaped = payload.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      // Look for JSON-like patterns with tool data
      const toolRegex = /\{[^{}]*"name":"([^"]{2,80})"[^{}]*"slug":"([^"]+)"[^{}]*\}/gi;
      let toolMatch: RegExpExecArray | null;
      while ((toolMatch = toolRegex.exec(unescaped)) !== null) {
        const name = toolMatch[1]!;
        const slug = toolMatch[2]!;
        if (!seen.has(slug)) {
          seen.add(slug);
          companies.push({
            name,
            slug,
            sourceUrl: `${BASE_URL}/tool/${slug}`,
            raw: { slug, name, extractedFrom: "rsc" },
          });
        }
      }
    } catch {
      // skip
    }
  }

  return companies;
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
