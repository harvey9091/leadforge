/**
 * =============================================================================
 * BetaList Source Adapter
 * =============================================================================
 *
 * Discovers companies from BetaList — a directory of early-stage startups.
 *
 * BetaList's main page (https://betalist.com) lists recently launched
 * startups. We scrape the HTML to extract company data.
 *
 * If the page structure changes or is unreachable, the adapter returns
 * empty results and logs a warning.
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";

const BASE_URL = "https://betalist.com";
const SOURCE_TYPE = "BETALIST" as const;
const RATE_LIMIT_PER_SEC = 0.5;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

export const betaListSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "BetaList",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 30,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting BetaList discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const result = await fetchWithRetry(BASE_URL, {
      responseType: "text",
      maxRetries: 2,
      timeoutMs: 20_000,
      headers: { Accept: "text/html" },
    });

    if (!result.ok) {
      ctx.log("warn", `BetaList: fetch failed (${result.status}) — skipping source`);
      ctx.updateProgress({ errorsCount: 1 });
      return;
    }

    const html = result.body as string;
    const companies = extractBetaListCompanies(html);

    ctx.log("info", `BetaList: extracted ${companies.length} companies from page`);

    if (companies.length === 0) {
      ctx.log("warn", "BetaList: no companies extracted — page structure may have changed");
      return;
    }

    ctx.updateProgress({ totalPages: 1, currentPage: 1 });

    let yielded = 0;
    for (const company of companies) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) return;

      // Apply keyword filter
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
        raw: company.raw,
      };

      yielded++;
      yield raw;
    }

    ctx.log("info", `BetaList discovery complete — ${yielded} companies yielded`);
  },
};

interface BetaListCompany {
  name: string;
  slug?: string;
  website?: string;
  description?: string;
  sourceUrl?: string;
  raw: unknown;
}

/**
 * Extract company data from BetaList's HTML.
 * BetaList renders startup cards with links to /startups/slug.
 */
function extractBetaListCompanies(html: string): BetaListCompany[] {
  const companies: BetaListCompany[] = [];
  const seen = new Set<string>();

  // Look for startup links: /startups/slug
  const linkRegex = /href="\/startups\/([a-z0-9-]+)"/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1]!;
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Extract nearby content for name and description
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(html.length, match.index + 1000);
    const nearby = html.slice(contextStart, contextEnd);

    // Try to find a name (usually in an <h2>, <h3>, or <a> tag near the link)
    const nameMatch = nearby.match(/<h[23][^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/h[23]>/i)
      || nearby.match(/<a[^>]*href="\/startups\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    const name = nameMatch?.[1]?.trim() || formatSlug(slug);

    // Try to find a description
    const descMatch = nearby.match(/<p[^>]*>([^<]{20,300})<\/p>/i);
    const description = descMatch?.[1]?.trim();

    companies.push({
      name,
      slug,
      sourceUrl: `https://betalist.com/startups/${slug}`,
      description: description ? stripHtml(description) : undefined,
      raw: { slug, extractedFrom: "link" },
    });
  }

  // Also try to find startup data in JSON-LD or script tags
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]!);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item?.["@type"] === "Organization" || item?.["@type"] === "Product") {
          const name = item.name;
          const url = item.url || item.sameAs;
          const slug = url?.match(/\/startups\/([a-z0-9-]+)/i)?.[1];
          if (name && slug && !seen.has(slug)) {
            seen.add(slug);
            companies.push({
              name,
              slug,
              website: item.url,
              description: item.description,
              sourceUrl: `https://betalist.com/startups/${slug}`,
              raw: item,
            });
          }
        }
      }
    } catch {
      // skip invalid JSON
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
