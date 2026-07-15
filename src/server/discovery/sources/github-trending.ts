/**
 * =============================================================================
 * GitHub Trending Source Adapter
 * =============================================================================
 *
 * Discovers companies from GitHub Trending repositories.
 *
 * GitHub Trending surfaces popular and growing repositories. Many of these
 * are real products, startups, and developer tools with commercial potential.
 *
 * API: https://github.com/trending (HTML scraping)
 * Auth: none required
 * Rate limit: 1 req per 2 seconds to respect GitHub's rate limits
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { stripHtml } from "../utils/xml";

const TRENDING_URL = "https://github.com/trending";
const SOURCE_TYPE = "GITHUB_TRENDING" as const;
const RATE_LIMIT_PER_SEC = 0.5;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

interface TrendingRepo {
  name: string;
  url: string;
  description?: string;
  language: string;
  stars: number;
  forks: number;
  period: string;
}

export const githubTrendingSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "GitHub Trending",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting GitHub Trending discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const repos = await fetchGitHubTrending(ctx);
    if (repos.length === 0) {
      ctx.log("warn", "GitHub Trending: no repositories found");
      return;
    }

    ctx.log("info", `GitHub Trending: found ${repos.length} repositories`);
    ctx.updateProgress({ totalPages: repos.length, currentPage: 1 });

    let yielded = 0;
    for (const repo of repos) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) return;

      if (params.keywords.length > 0) {
        const text = `${repo.name} ${repo.description} ${repo.language}`.toLowerCase();
        if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
      }

      const raw: RawCompany = {
        externalId: repo.url,
        source: SOURCE_TYPE,
        name: repo.name.split("/")[1] ?? repo.name,
        description: repo.description ? stripHtml(repo.description).slice(0, 500) : undefined,
        industry: repo.language ? `Software / ${repo.language}` : "Software",
        sourceUrl: repo.url,
        publishedAt: new Date().toISOString(),
        tags: [repo.language].filter(Boolean),
        raw: {
          ...repo,
          extractedFrom: "github-trending",
        },
      };

      yielded++;
      yield raw;
    }

    ctx.log("info", `GitHub Trending discovery complete — ${yielded} companies yielded`);
  },
};

async function fetchGitHubTrending(ctx: DiscoveryContext): Promise<TrendingRepo[]> {
  const result = await fetchWithRetry(TRENDING_URL, {
    responseType: "text",
    maxRetries: 2,
    timeoutMs: 20_000,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; LeadForge/1.0)",
    },
  });

  if (!result.ok) {
    ctx.log("warn", `GitHub Trending fetch failed (${result.status})`);
    return [];
  }

  return parseGitHubTrending(result.body as string);
}

function parseGitHubTrending(html: string): TrendingRepo[] {
  const repos: TrendingRepo[] = [];
  const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(html)) !== null) {
    const article = match[1]!;

    const repoLinkMatch = article.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!repoLinkMatch) continue;

    const repoPath = repoLinkMatch[1]!.trim();
    const repoName = repoPath.replace(/^\/+/, "").replace(/\/+$/, "");
    const repoUrl = `https://github.com${repoPath}`;

    const descMatch = article.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch ? stripHtml(descMatch[1]!).trim() : "";

    const langMatch = article.match(/<span[^>]*itemprop="programmingLanguage"[^>]*>([^<]+)<\/span>/i);
    const language = langMatch ? langMatch[1]!.trim() : "";

    const starsMatch = article.match(/<a[^>]+href="[^"]+\/stargazers"[^>]*>[\s\S]*?(\d+(?:,\d+)*)/i);
    const stars = starsMatch ? parseInt(starsMatch[1]!.replace(/,/g, ""), 10) : 0;

    const forksMatch = article.match(/<a[^>]+href="[^"]+\/forks"[^>]*>[\s\S]*?(\d+(?:,\d+)*)/i);
    const forks = forksMatch ? parseInt(forksMatch[1]!.replace(/,/g, ""), 10) : 0;

    if (repoName) {
      repos.push({
        name: repoName,
        url: repoUrl,
        description: description || undefined,
        language,
        stars,
        forks,
        period: "daily",
      });
    }
  }

  return repos;
}
