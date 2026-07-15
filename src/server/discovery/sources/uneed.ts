/**
 * =============================================================================
 * Uneed Source Adapter
 * =============================================================================
 *
 * Discovers companies/products from Uneed's sitemap.
 *
 * Strategy:
 *  1. Fetch the sitemap index at https://www.uneed.best/sitemap.xml
 *     to find the tools sitemap URL
 *  2. Fetch the tools sitemap at https://www.uneed.best/__sitemap__/tools.xml
 *     to discover all product/tool URLs
 *  3. For each tool URL, fetch the page and extract data from:
 *     a. Server-rendered meta tags (title, description, og:image)
 *     b. Embedded JSON data in script tags
 *     c. Structured page content
 *
 * Rate limit: 0.5 req/sec minimum
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { extractXmlTag, extractXmlAttr, decodeHtmlEntities, escapeRegex, stripHtml } from "../utils/xml";

const SITEMAP_INDEX_URL = "https://www.uneed.best/sitemap.xml";
const BASE_URL = "https://www.uneed.best";
const SOURCE_TYPE = "UNEED" as const;
const RATE_LIMIT_PER_SEC = 0.5;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

export const uneedSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "Uneed",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting Uneed discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const toolUrls = await fetchUneedSitemap(ctx);
    if (toolUrls.length === 0) {
      ctx.log("warn", "Uneed: no tool URLs found in sitemap");
      return;
    }

    ctx.log("info", `Uneed: found ${toolUrls.length} tools in sitemap`);
    ctx.updateProgress({ totalPages: Math.min(toolUrls.length, params.maxPages * this.defaultPageSize), currentPage: 1 });

    const maxToFetch = Math.min(toolUrls.length, params.maxPages * this.defaultPageSize);
    const urlsToFetch = toolUrls.slice(0, maxToFetch);

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
          ctx.log("debug", `Uneed: skipped ${url} (HTTP ${pageResult.status})`);
          continue;
        }

        const html = pageResult.body as string;
        const company = extractUneedCompany(html, url, ctx);
        if (!company) continue;

        if (params.keywords.length > 0) {
          const text = `${company.name} ${company.description ?? ""}`.toLowerCase();
          if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
        }

        yielded++;
        yield company;
      } catch (err) {
        ctx.log("debug", `Uneed: error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    ctx.log("info", `Uneed discovery complete — ${yielded} companies yielded`);
  },
};

async function fetchUneedSitemap(ctx: DiscoveryContext): Promise<string[]> {
  const indexResult = await fetchWithRetry(SITEMAP_INDEX_URL, {
    responseType: "text",
    maxRetries: 2,
    timeoutMs: 20_000,
    headers: { Accept: "application/xml, text/xml" },
  });

  if (!indexResult.ok) {
    ctx.log("warn", `Uneed sitemap index fetch failed (${indexResult.status})`);
    return [];
  }

  const toolsSitemapUrl = extractToolsSitemapUrl(indexResult.body as string);
  if (!toolsSitemapUrl) {
    ctx.log("warn", "Uneed: could not find tools sitemap in index");
    return [];
  }

  ctx.log("info", `Uneed: fetching tools sitemap: ${toolsSitemapUrl}`);

  await rateLimiter.wait();

  const toolsResult = await fetchWithRetry(toolsSitemapUrl, {
    responseType: "text",
    maxRetries: 2,
    timeoutMs: 20_000,
    headers: { Accept: "application/xml, text/xml" },
  });

  if (!toolsResult.ok) {
    ctx.log("warn", `Uneed tools sitemap fetch failed (${toolsResult.status})`);
    return [];
  }

  return parseSitemapUrls(toolsResult.body as string);
}

function extractToolsSitemapUrl(xml: string): string | undefined {
  const match = xml.match(/<loc>\s*(https?:\/\/[^<]*tools[^<]*\.xml)\s*<\/loc>/i);
  return match?.[1]?.trim();
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const urlRegex = /<loc>([^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(xml)) !== null) {
    const loc = match[1]!.trim();
    if (loc.startsWith("https://www.uneed.best/tool/")) {
      urls.push(loc);
    }
  }

  return urls;
}

function extractUneedCompany(
  html: string,
  url: string,
  ctx: DiscoveryContext
): RawCompany | null {
  const slug = url.replace("https://www.uneed.best/tool/", "").replace("/", "");

  const name = extractMetaContent(html, "og:title") ??
    extractTitle(html) ??
    formatSlug(slug);

  const description = extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description") ??
    extractMainContent(html);

  const website = extractMetaContent(html, "og:url") ??
    extractProductWebsite(html);

  const logoUrl = extractMetaContent(html, "og:image");
  const publishedAt = extractMetaContent(html, "article:published_time");

  const tags = extractTags(html);

  if (!name || name.length < 2) return null;

  return {
    externalId: slug,
    source: SOURCE_TYPE,
    name: name.slice(0, 120),
    website,
    description: description?.slice(0, 500),
    logoUrl,
    sourceUrl: url,
    publishedAt,
    tags: tags.length > 0 ? tags : undefined,
    raw: { slug, name, description, extractedFrom: "sitemap-page" },
  };
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!match) return undefined;
  let title = match[1]!.trim();
  title = title.replace(/\s*[|–—:·-].*$/, "").trim();
  return title || undefined;
}

function extractMetaContent(html: string, propertyName: string): string | undefined {
  const escaped = escapeRegex(propertyName);
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}"[^>]+content=["']([^"']+)["']\\s*\/?>`,
    "i"
  );
  const match = pattern.exec(html);
  if (match) return decodeHtmlEntities(match[1]!);

  const pattern2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}"[^>]*\\s*\/?>`,
    "i"
  );
  const match2 = pattern2.exec(html);
  if (match2) return decodeHtmlEntities(match2[1]!);

  return undefined;
}

function extractProductWebsite(html: string): string | undefined {
  const patterns = [
    /href="(https?:\/\/[^"]+)"[^>]*class="[^"]*(?:btn-primary|btn-secondary|visit-btn|website-btn|external-link)[^"]*"/i,
    /"website"\s*:\s*"([^"]+)"/i,
    /"url"\s*:\s*"([^"]+)"[^}]*"domain"/i,
    /data-website="([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      const url = match[1]!.trim();
      if (url && !url.includes("uneed.best") && !url.includes("utm_")) return url;
    }
  }

  return undefined;
}

function extractMainContent(html: string): string | undefined {
  const patterns = [
    /<meta[^>]+name="description"[^>]+content="([^"]{20,300})"/i,
    /<p[^>]+class="[^"]*(?:description|content|summary)[^"]*"[^>]*>([^<]{20,500})<\/p>/i,
    /<div[^>]+class="[^"]*(?:description|content|summary)[^"]*"[^>]*>([^<]{20,500})<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return decodeHtmlEntities(match[1]!).trim();
  }

  const jsonMatch = html.match(/"description"\s*:\s*"([^"]{20,500})"/i);
  if (jsonMatch) return decodeHtmlEntities(jsonMatch[1]!).trim();

  return undefined;
}

function extractTags(html: string): string[] {
  const tags: string[] = [];
  const tagRegex = /<a[^>]+href="\/tag\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null && tags.length < 10) {
    const tag = match[1]!.trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }

  return tags;
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/\s*-\s*/g, " ");
}
