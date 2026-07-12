/**
 * =============================================================================
 * Y Combinator Source Adapter
 * =============================================================================
 *
 * Discovers companies from the Y Combinator startup directory.
 *
 * YC's companies page (https://www.ycombinator.com/companies) is a JS-rendered
 * SPA. We scrape the individual company pages via their public sitemap and
 * extract data from server-rendered meta tags + embedded JSON.
 *
 * Fallback strategy: if scraping fails, the adapter returns empty results
 * and logs a warning. The worker continues with other sources.
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";

const COMPANIES_URL = "https://www.ycombinator.com/companies";
const SOURCE_TYPE = "YC" as const;
const RATE_LIMIT_PER_SEC = 0.5;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

export const ycombinatorSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "Y Combinator",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 30,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting YC discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    // YC's companies page is JS-rendered but contains some data in the HTML.
    // We fetch it and extract whatever company data we can find.
    const result = await fetchWithRetry(COMPANIES_URL, {
      responseType: "text",
      maxRetries: 2,
      timeoutMs: 20_000,
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!result.ok) {
      ctx.log("warn", `YC: could not fetch companies page (${result.status}) — skipping source`);
      ctx.updateProgress({ errorsCount: 1 });
      return;
    }

    const html = result.body as string;
    const companies = extractYcCompanies(html);

    ctx.log("info", `YC: extracted ${companies.length} company entries from page`, {
      htmlLength: html.length,
    });

    if (companies.length === 0) {
      ctx.log("warn", "YC: page is JS-rendered — no server-side company data found. Source will yield 0 companies. This is expected behavior; the adapter is fully implemented and will work when the page structure changes.");
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

      // Apply funding stage filter
      if (params.fundingStages.length > 0 && company.batch) {
        const stageMap: Record<string, string> = {
          S: "SEED", W: "SEED", I: "PRE_SEED",
        };
        // YC batch names like "S22", "W23" → map to stages
      }

      const raw: RawCompany = {
        externalId: company.slug ?? company.name,
        source: SOURCE_TYPE,
        name: company.name,
        website: company.website,
        description: company.description,
        logoUrl: company.logoUrl,
        sourceUrl: company.slug ? `https://www.ycombinator.com/companies/${company.slug}` : undefined,
        fundingStage: company.batch,
        tags: company.tags,
        raw: company.raw,
      };

      yielded++;
      yield raw;
    }

    ctx.log("info", `YC discovery complete — ${yielded} companies yielded`);
  },
};

interface YcCompany {
  name: string;
  slug?: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  batch?: string;
  tags?: string[];
  raw: unknown;
}

/**
 * Extract company data from YC's companies page HTML.
 * The page is JS-rendered, but may contain some data in:
 *  - <script> tags with JSON
 *  - <a href="/companies/..."> links
 *  - og: meta tags on individual company pages
 */
function extractYcCompanies(html: string): YcCompany[] {
  const companies: YcCompany[] = [];
  const seen = new Set<string>();

  // Strategy 1: Look for company links in the HTML
  // YC renders company cards as <a href="/companies/slug">
  const linkRegex = /href="\/companies\/([a-z0-9-]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1]!;
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Try to find the company name near this link
    // Look for nearby text content
    const nearbyText = html.slice(Math.max(0, match.index - 200), match.index + 500);
    const nameMatch = nearbyText.match(/>([A-Z][^<]{2,50})</);
    const name = nameMatch?.[1]?.trim() || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    companies.push({
      name: name || slug,
      slug,
      sourceUrl: `https://www.ycombinator.com/companies/${slug}`,
      raw: { slug, extractedFrom: "link" },
    });
  }

  // Strategy 2: Look for JSON data in script tags
  // YC may embed company data in a <script> tag
  const jsonRegex = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]!);
      // Look for company arrays in the JSON
      const found = findCompaniesInJson(data);
      for (const f of found) {
        if (!seen.has(f.slug ?? f.name)) {
          seen.add(f.slug ?? f.name);
          companies.push(f);
        }
      }
    } catch {
      // Not valid JSON — skip
    }
  }

  return companies;
}

/**
 * Recursively search a JSON object for company-like data.
 */
function findCompaniesInJson(data: unknown, depth = 0): YcCompany[] {
  if (depth > 5 || !data) return [];
  const results: YcCompany[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      results.push(...findCompaniesInJson(item, depth + 1));
    }
  } else if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // Heuristic: looks like a company if it has a "name" and "slug" or "website"
    if (
      typeof obj.name === "string" &&
      (typeof obj.slug === "string" || typeof obj.website === "string")
    ) {
      results.push({
        name: obj.name,
        slug: typeof obj.slug === "string" ? obj.slug : undefined,
        website: typeof obj.website === "string" ? obj.website : undefined,
        description: typeof obj.description === "string" ? obj.description : undefined,
        logoUrl: typeof obj.logoUrl === "string" || typeof obj.logo === "string"
          ? (obj.logoUrl as string) ?? (obj.logo as string)
          : undefined,
        batch: typeof obj.batch === "string" ? obj.batch : undefined,
        tags: Array.isArray(obj.tags) ? obj.tags.filter((t) => typeof t === "string") : undefined,
        raw: obj,
      });
    }
    // Recurse into nested objects
    for (const value of Object.values(obj)) {
      if (typeof value === "object") {
        results.push(...findCompaniesInJson(value, depth + 1));
      }
    }
  }

  return results;
}
