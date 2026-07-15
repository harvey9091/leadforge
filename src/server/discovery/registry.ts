/**
 * =============================================================================
 * Discovery Source Registry
 * =============================================================================
 *
 * The single place where all discovery sources are registered. Adding a
 * new source = implementing the `DiscoverySource` interface + adding it
 * to this array. No other code changes required.
 *
 * The worker iterates this registry to discover from all configured
 * sources. The UI reads this to show available sources in the create-job
 * form.
 * =============================================================================
 */

import type { DiscoverySource } from "./types";
import type { SourceType } from "@prisma/client";
import { hackerNewsSource } from "./sources/hacker-news";
import { productHuntSource } from "./sources/product-hunt";
import { ycombinatorSource } from "./sources/ycombinator";
import { betaListSource } from "./sources/betalist";
import { devHuntSource } from "./sources/devhunt";
import { uneedSource } from "./sources/uneed";
import { githubTrendingSource } from "./sources/github-trending";
import { peerlistSource } from "./sources/peerlist";
import { indieHackersSource } from "./sources/indie-hackers";
import { microLaunchSource } from "./sources/microlaunch";

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  hackerNewsSource,
  productHuntSource,
  ycombinatorSource,
  betaListSource,
  devHuntSource,
  uneedSource,
  githubTrendingSource,
  peerlistSource,
  indieHackersSource,
  microLaunchSource,
];

/** Source metadata for the UI (no adapter logic). */
export const SOURCE_METADATA: Array<{
  id: SourceType;
  label: string;
  description: string;
  rateLimitPerSec: number;
}> = DISCOVERY_SOURCES.map((s) => ({
  id: s.id,
  label: s.label,
  description: getSourceDescription(s.id),
  rateLimitPerSec: s.rateLimitPerSec,
}));

function getSourceDescription(id: SourceType): string {
  const descriptions: Record<SourceType, string> = {
    HACKER_NEWS: "Show HN posts on Hacker News — founders launching products",
    PRODUCT_HUNT: "Daily product launches on Product Hunt",
    YC: "Y Combinator startup directory",
    BETALIST: "Early-stage startup launches on BetaList",
    DEVHUNT: "Developer tool launches on DevHunt",
    UNEED: "SaaS tools directory on Uneed",
    GITHUB_TRENDING: "Trending repositories on GitHub — discover new tools and projects",
    PEERLIST: "Startup launches on Peerlist — founders sharing their products",
    INDIE_HACKERS: "Indie Hackers launches — side projects and micro-startups",
    MICROLAUNCH: "MicroLaunch — early-stage products and micro-startups",
    SEC_EDGAR: "SEC EDGAR filings (future)",
    GREENHOUSE: "Greenhouse job boards (future)",
    LEVER: "Lever job boards (future)",
    ASHBY: "Ashby job boards (future)",
    MANUAL: "Manually added companies",
    API: "API-submitted companies",
  };
  return descriptions[id] ?? "Unknown source";
}

/**
 * Get a source adapter by ID.
 */
export function getSource(id: SourceType): DiscoverySource | undefined {
  return DISCOVERY_SOURCES.find((s) => s.id === id);
}

/**
 * Get source adapters for a list of IDs.
 * If the list is empty, returns all sources.
 */
export function getSources(ids: SourceType[]): DiscoverySource[] {
  if (ids.length === 0) return DISCOVERY_SOURCES;
  return DISCOVERY_SOURCES.filter((s) => ids.includes(s.id));
}
