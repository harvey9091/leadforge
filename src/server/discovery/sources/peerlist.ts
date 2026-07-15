/**
 * =============================================================================
 * Peerlist Launches Source Adapter
 * =============================================================================
 *
 * Discovers companies from Peerlist launches/launches feed.
 *
 * Peerlist is a professional network for startups and founders where
 * products are launched and shared with the community.
 *
 * Feed: https://peerlist.io/launches (public page)
 * Auth: none required for public content
 * Rate limit: 1 req per 3 seconds
 * =============================================================================
 */

import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";
import { stripHtml } from "../utils/xml";

const LAUNCHES_URL = "https://peerlist.io/launches";
const SOURCE_TYPE = "PEERLIST" as const;
const RATE_LIMIT_PER_SEC = 0.33;

const rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);

interface PeerlistLaunch {
  id: string;
  name: string;
  description?: string;
  url: string;
  website?: string;
  likes?: number;
  comments?: number;
  author?: string;
  createdAt: string;
}

export const peerlistSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "Peerlist",
  rateLimitPerSec: RATE_LIMIT_PER_SEC,
  defaultPageSize: 50,

  async *discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting Peerlist discovery");
    ctx.updateProgress({ currentSource: this.label, currentPage: 1 });

    if (!ctx.shouldContinue()) return;

    await rateLimiter.wait();

    const launches = await fetchPeerlistLaunches(ctx);
    if (launches.length === 0) {
      ctx.log("warn", "Peerlist: no launches found");
      return;
    }

    ctx.log("info", `Peerlist: found ${launches.length} launches`);
    ctx.updateProgress({ totalPages: launches.length, currentPage: 1 });

    let yielded = 0;
    for (const launch of launches) {
      if (!ctx.shouldContinue()) return;
      if (yielded >= params.maxCompanies) return;

      if (params.keywords.length > 0) {
        const text = `${launch.name} ${launch.description}`.toLowerCase();
        if (!params.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
      }

      const raw: RawCompany = {
        externalId: launch.id,
        source: SOURCE_TYPE,
        name: launch.name,
        description: launch.description ? stripHtml(launch.description).slice(0, 500) : undefined,
        website: launch.website,
        sourceUrl: launch.url,
        publishedAt: launch.createdAt,
        raw: {
          ...launch,
          extractedFrom: "peerlist-launches",
        },
      };

      yielded++;
      yield raw;
    }

    ctx.log("info", `Peerlist discovery complete — ${yielded} companies yielded`);
  },
};

async function fetchPeerlistLaunches(ctx: DiscoveryContext): Promise<PeerlistLaunch[]> {
  const result = await fetchWithRetry(LAUNCHES_URL, {
    responseType: "text",
    maxRetries: 2,
    timeoutMs: 20_000,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; LeadForge/1.0)",
    },
  });

  if (!result.ok) {
    ctx.log("warn", `Peerlist fetch failed (${result.status})`);
    return [];
  }

  return parsePeerlistLaunches(result.body as string);
}

function parsePeerlistLaunches(html: string): PeerlistLaunch[] {
  const launches: PeerlistLaunch[] = [];

  const cardRegex = /<a[^>]+href="\/launches\/([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const id = match[1]!.trim();
    const title = stripHtml(match[2]!).trim();
    const description = stripHtml(match[3]!).trim();

    if (title) {
      launches.push({
        id,
        name: title,
        description: description || undefined,
        url: `https://peerlist.io/launches/${id}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]!);
      if (data.launches && Array.isArray(data.launches)) {
        for (const launch of data.launches) {
          if (launch.id && launch.name && !launches.find((l) => l.id === launch.id)) {
            launches.push({
              id: launch.id,
              name: launch.name,
              description: launch.description || launch.tagline || undefined,
              url: `https://peerlist.io/launches/${launch.id}`,
              website: launch.website || launch.url,
              likes: launch.likes ?? 0,
              comments: launch.comments ?? 0,
              author: launch.author?.name,
              createdAt: launch.createdAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // JSON parse failed — use regex results
    }
  }

  return launches;
}
