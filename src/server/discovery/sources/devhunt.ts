/**
 * =============================================================================
 * DevHunt Source Adapter
 * =============================================================================
 *
 * Discovers companies from DevHunt's sitemap.
 *
 * Strategy:
 *  1. Fetch the sitemap at https://devhunt.org/sitemap.xml to discover
 *     all tool/product URLs (format: /tool/slug)
 *  2. For each tool URL, fetch the page and extract data from:
 *     a. Server-rendered meta tags (title, description, og:image)
 *     b. Next.js RSC flight data (self.__next_f.push calls)
 *     c. JSON-LD structured data
 *
 * Rate limit: 0.5 req/sec minimum
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { extractXmlTag, decodeHtmlEntities, escapeRegex, stripHtml } from "../utils/xml";

const SITEMAP_URL = "https://devhunt.org/sitemap.xml";
const BASE_URL = "https://devhunt.org";
const SOURCE_TYPE = "DEVHUNT" as const;
const RATE_LIMIT_PER_SEC = 0.5;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

export const devHuntSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "DevHunt",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting DevHunt discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const toolUrls = await fetchDevHuntSitemap(ctx);
    if (toolUrls.length === 0) {
      ctx.log("warn", "DevHunt: no tool URLs found in sitemap");
      return;
    }

    ctx.log("info", `DevHunt: found ${toolUrls.length} tools in sitemap`);
    ctx.updateProgress({ totalPages: toolUrls.length, currentPage: 1 });

    const maxPages = Math.min(toolUrls.length, params.maxPages * this.defaultPageSize);
    const urlsToFetch = toolUrls.slice(0, maxPages);

    let yielded = 0;
    for (let i = 0; i < urlsToFetch.length; i++) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) return;

      const url = urlsToFetch[i]!;
      await rateLimiter.wait();

      ctx.updateProgress({ currentPage: i + 1 });

      try {
        const pageResult = await fetchWithRetry(url, {
          responseType: "text",
          maxRetries: 1,
          timeoutMs: 15_000,
          headers: { Accept: "text/html" },
        });

        if (!pageResult.ok) {
          ctx.log("debug", `DevHunt: skipped ${url} (HTTP ${pageResult.status})`);
          continue;
        }

        const html = pageResult.body as string;
        const company = extractDevHuntCompany(html, url, ctx);
        if (!company) continue;

        if (params.keywords.length > 0) {
          const text = `${company.name} ${company.description ?? ""}`.toLowerCase();
          if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
        }

        yielded++;
        yield company;
      } catch (err) {
        ctx.log("debug", `DevHunt: error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    ctx.log("info", `DevHunt discovery complete — ${yielded} companies yielded`);
  },
};

async function fetchDevHuntSitemap(ctx: DiscoveryContext): Promise<string[]> {
  const result = await fetchWithRetry(SITEMAP_URL, {
    responseType: "text",
    maxRetries: 2,
    timeoutMs: 20_000,
    headers: { Accept: "application/xml, text/xml" },
  });

  if (!result.ok) {
    ctx.log("warn", `DevHunt sitemap fetch failed (${result.status})`);
    return [];
  }

  return parseSitemapUrls(result.body as string);
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const urlRegex = /<loc>([^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(xml)) !== null) {
    const loc = match[1]!.trim();
    if (loc.startsWith("https://devhunt.org/tool/")) {
      urls.push(loc);
    }
  }

  return urls;
}

function extractDevHuntCompany(
  html: string,
  url: string,
  ctx: DiscoveryContext
): RawCompany | null {
  const slug = url.replace("https://devhunt.org/tool/", "").replace("/", "");

  const name = extractMetaContent(html, "og:title") ??
    extractTitle(html) ??
    formatSlug(slug);

  const description = extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description") ??
    extractFromRscData(html, ctx);

  const website = extractMetaContent(html, "og:url") ??
    extractProductWebsite(html);

  const logoUrl = extractMetaContent(html, "og:image");
  const publishedAt = extractMetaContent(html, "article:published_time");

  if (!name || name.length < 2) return null;

  return {
    externalId: slug,
    source: SOURCE_TYPE,
    name: name.slice(0, 120),
    website: website && !website.includes("devhunt.org") ? website : undefined,
    description: description?.slice(0, 500),
    logoUrl,
    sourceUrl: url,
    publishedAt,
    tags: extractTags(html),
    raw: { slug, name, description, extractedFrom: "sitemap-page" },
  };
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim().replace(/\s*[|–—:].*$/, "").trim() || undefined;
}

function extractMetaContent(html: string, propertyName: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRegex(propertyName)}["'][^>]+content=["']([^"']+)["']\\s*/>`,
    "i"
  );
  const match = pattern.exec(html);
  if (match) return decodeHtmlEntities(match[1]!);

  const pattern2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegex(propertyName)}["']\\s*/>`,
    "i"
  );
  const match2 = pattern2.exec(html);
  if (match2) return decodeHtmlEntities(match2[1]!);

  return undefined;
}

function extractProductWebsite(html: string): string | undefined {
  const linkMatch = html.match(/href="(https?:\/\/[^"]+)"[^>]*class="[^"]*text-orange/);
  if (linkMatch) return linkMatch[1]!;
  return undefined;
}

function extractFromRscData(html: string, ctx: DiscoveryContext): string | undefined {
  try {
    const rscRegex = /self\.__next_f\.push\(\[1,"([^"]*)"\]\)/gi;
    let match: RegExpExecArray | null;

    while ((match = rscRegex.exec(html)) !== null) {
      const payload = match[1]!;
      try {
        const unescaped = payload
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");

        const aboutMatch = unescaped.match(/"about[^"]*"\s*:\s*"([^"]{20,500})"/i);
        if (aboutMatch) return aboutMatch[1]!;

        const descMatch = unescaped.match(/"description[^"]*"\s*:\s*"([^"]{20,500})"/i);
        if (descMatch) return descMatch[1]!;
      } catch {
        // skip individual RSC payload errors
      }
    }
  } catch {
    // skip
  }
  return undefined;
}

function extractTags(html: string): string[] | undefined {
  const tags: string[] = [];
  const tagRegex = /<a[^>]+class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1]!.trim();
    if (tag && !tags.includes(tag) && tags.length < 10) tags.push(tag);
  }

  return tags.length > 0 ? tags : undefined;
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/\s*-\s*/g, " ");
}
