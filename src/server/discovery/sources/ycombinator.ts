/**
 * =============================================================================
 * Y Combinator Source Adapter
 * =============================================================================
 *
 * Discovers companies from the Y Combinator startup directory.
 *
 * Primary strategy: YC's companies page uses Inertia.js. We make an
 * Inertia-style request (X-Inertia header) to get server-rendered JSON
 * containing all company data, then extract it from the page props.
 *
 * Fallback: if the Inertia request fails (non-JSON response), we parse
 * the HTML page directly for company data embedded in the page markup.
 *
 * Rate limit: 0.5 req/sec (1 request per 2 seconds) — respects YC's rate limits.
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
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting YC discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const companies = await fetchYcCompanies(params, ctx);

    ctx.log("info", `YC: extracted ${companies.length} companies`);
    ctx.updateProgress({ totalPages: 1, currentPage: 1 });

    let yielded = 0;
    for (const company of companies) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) return;

      if (params.keywords.length > 0) {
        const text = `${company.name} ${company.description ?? ""}`.toLowerCase();
        if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
      }

      if (params.fundingStages.length > 0 && company.batch) {
        const batchLower = company.batch.toLowerCase();
        const matched = params.fundingStages.some((s) => {
          const sl = s.toLowerCase();
          if (sl === "seed" && (batchLower.includes("winter") || batchLower.includes("summer"))) return true;
          if (sl === "pre_seed" && batchLower.includes("pre-seed")) return true;
          return false;
        });
        if (!matched) continue;
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
        industry: company.industry,
        country: company.location,
        foundedYear: company.foundedYear,
        employeeEstimate: company.teamSize ? String(company.teamSize) : undefined,
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
  industry?: string;
  location?: string;
  foundedYear?: number;
  teamSize?: number;
  tags?: string[];
  raw: unknown;
}

async function fetchYcCompanies(
  params: DiscoveryParams,
  ctx: DiscoveryContext
): Promise<YcCompany[]> {
  const result = await fetchWithRetry(COMPANIES_URL, {
    responseType: "text",
    maxRetries: 2,
    timeoutMs: 20_000,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "X-Inertia": "true",
      "X-Inertia-Version": "1",
    },
  });

  if (!result.ok) {
    ctx.log("warn", `YC: fetch failed (${result.status}) — trying fallback`);
    return extractFromYcCompaniesPageHtml(result.body as string);
  }

  const body = result.body as string;

  if (result.headers && typeof (result.headers as Record<string, string>)["content-type"] !== "undefined") {
    const ct = (result.headers as Record<string, string>)["content-type"] || "";
    if (ct.includes("application/json")) {
      try {
        const json = JSON.parse(body);
        return extractFromYcInertiaResponse(json, ctx);
      } catch {
        ctx.log("warn", "YC: JSON parse failed — falling back to HTML parsing");
        return extractFromYcCompaniesPageHtml(body);
      }
    }
  }

  if (body.trim().startsWith("{") || body.trim().startsWith("[")) {
    try {
      const json = JSON.parse(body);
      return extractFromYcInertiaResponse(json, ctx);
    } catch {
      return extractFromYcCompaniesPageHtml(body);
    }
  }

  return extractFromYcCompaniesPageHtml(body);
}

function extractFromYcInertiaResponse(
  data: unknown,
  ctx: DiscoveryContext
): YcCompany[] {
  try {
    const root = data as Record<string, unknown>;
    const props = root.props as Record<string, unknown> | undefined;
    if (!props) {
      ctx.log("warn", "YC Inertia: no props in response");
      return [];
    }

    const companies = findCompaniesInInertiaProps(props, 0);
    ctx.log("info", `YC Inertia: found ${companies.length} companies in response`);
    return companies;
  } catch (err) {
    ctx.log("warn", `YC Inertia: extraction error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

function findCompaniesInInertiaProps(
  props: Record<string, unknown>,
  depth: number
): YcCompany[] {
  if (depth > 8) return [];

  for (const [key, value] of Object.entries(props)) {
    const lowerKey = key.toLowerCase();
    if ((lowerKey === "companies" || lowerKey === "company" || lowerKey === "data") && Array.isArray(value)) {
      const arr = value as unknown[];
      const companies = findCompaniesInArray(arr, depth + 1);
      if (companies.length > 0) return companies;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = findCompaniesInInertiaProps(value as Record<string, unknown>, depth + 1);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function findCompaniesInArray(arr: unknown[], depth: number): YcCompany[] {
  if (depth > 8) return [];
  const results: YcCompany[] = [];

  for (const item of arr) {
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;

      if (typeof obj.name === "string" && obj.name.length > 1 && obj.name.length < 120) {
        const hasSlug = typeof obj.slug === "string";
        const hasWebsite = typeof obj.website === "string" || typeof obj.homepage === "string";
        const hasDescription = typeof obj.description === "string";
        const hasId = typeof obj.id === "string" || typeof obj.objectID === "string";

        if (hasSlug || hasWebsite || hasDescription || hasId) {
          const website = (typeof obj.website === "string" ? obj.website : undefined) ||
            (typeof obj.homepage === "string" ? obj.homepage : undefined);
          const slug = typeof obj.slug === "string" ? obj.slug : (typeof obj.id === "string" ? obj.id : undefined);

          let industry: string | undefined;
          if (Array.isArray(obj.industries) && obj.industries.length > 0) {
            const ind = obj.industries[0];
            if (typeof ind === "object" && ind !== null) {
              industry = (ind as Record<string, unknown>).name as string | undefined;
            } else if (typeof ind === "string") {
              industry = ind;
            }
          }
          if (!industry && typeof obj.industry === "string") industry = obj.industry;
          if (!industry && typeof obj.category === "string") industry = obj.category;

          let location: string | undefined;
          if (Array.isArray(obj.locations) && obj.locations.length > 0) {
            const loc = obj.locations[0];
            if (typeof loc === "object" && loc !== null) {
              location = (loc as Record<string, unknown>).name as string | undefined;
            } else if (typeof loc === "string") {
              location = loc;
            }
          }
          if (!location && typeof obj.location === "string") location = obj.location;
          if (!location && typeof obj.headquarters === "string") location = obj.headquarters;

          let foundedYear: number | undefined;
          if (typeof obj.foundedYear === "number") foundedYear = obj.foundedYear;
          else if (typeof obj.founded === "number") foundedYear = obj.founded;
          else if (typeof obj.yearFounded === "number") foundedYear = obj.yearFounded;
          else if (typeof obj.founded_at === "string") {
            const yr = parseInt(obj.founded_at as string, 10);
            if (!isNaN(yr)) foundedYear = yr;
          }

          let teamSize: number | undefined;
          if (typeof obj.teamSize === "number") teamSize = obj.teamSize;
          else if (typeof obj.num_employees === "number") teamSize = obj.num_employees;
          else if (typeof obj.employees === "number") teamSize = obj.employees;

          const batch = typeof obj.batch === "string" ? obj.batch :
            (typeof obj.batchName === "string" ? obj.batchName : undefined);

          const logoUrl = (typeof obj.logoUrl === "string" ? obj.logoUrl : undefined) ||
            (typeof obj.logo === "string" ? obj.logo : undefined) ||
            (typeof obj.image === "string" ? obj.image : undefined);

          const description = typeof obj.description === "string" ? obj.description :
            (typeof obj.shortDescription === "string" ? obj.shortDescription : undefined);

          const tags: string[] = [];
          if (Array.isArray(obj.tags)) {
            for (const t of obj.tags) { if (typeof t === "string") tags.push(t); }
          }
          if (Array.isArray(obj.categories)) {
            for (const c of obj.categories) {
              const catName = typeof c === "object" && c !== null ? (c as Record<string, unknown>).name as string | undefined : undefined;
              if (catName && !tags.includes(catName)) tags.push(catName);
            }
          }

          results.push({
            name: obj.name,
            slug,
            website,
            description: description?.slice(0, 500),
            logoUrl,
            batch,
            industry,
            location,
            foundedYear,
            teamSize,
            tags: tags.length > 0 ? tags : undefined,
            raw: obj,
          });
          continue;
        }
      }

      if (Array.isArray(obj.companies) || Array.isArray(obj.data)) {
        const nested = findCompaniesInArray(
          (obj.companies || obj.data) as unknown[],
          depth + 1
        );
        if (nested.length > 0) {
          results.push(...nested);
          continue;
        }
      }

      if (depth < 6) {
        const nested = findCompaniesInInertiaProps(obj, depth + 1);
        if (nested.length > 0) {
          results.push(...nested);
        }
      }
    }
  }

  return results;
}

function extractFromYcCompaniesPageHtml(html: string): YcCompany[] {
  const companies: YcCompany[] = [];
  const seen = new Set<string>();

  const linkRegex = /href="\/companies\/([a-z0-9-]+)"/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1]!;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const nearby = html.slice(Math.max(0, match.index - 300), match.index + 600);
    const nameMatch = nearby.match(/>([A-Z][A-Za-z0-9 &().,'-]{2,60})</);
    const name = nameMatch?.[1]?.trim() || formatSlug(slug);

    const websiteMatch = nearby.match(/href="(https?:\/\/[^"]+)"[^>]*class="[^"]*company-website/);
    const descMatch = nearby.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]{20,300})<\/p>/i);

    companies.push({
      name,
      slug,
      website: websiteMatch?.[1],
      description: descMatch?.[1]?.trim(),
      raw: { slug, extractedFrom: "html-link" },
    });
  }

  return companies;
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
