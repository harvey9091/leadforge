/**
 * =============================================================================
 * Leadforge — Discovery Service (Phase 2)
 * =============================================================================
 *
 * Discovers companies from public internet sources.
 *
 * Sources (per Architecture v1.0):
 *  - YC API (Y Combinator companies + batches)
 *  - Product Hunt (recent launches)
 *  - BetaList
 *  - Uneed
 *  - DevHunt
 *  - Hacker News (Show HN)
 *  - SEC EDGAR (filings)
 *  - Greenhouse / Lever / Ashby (job board scrapes)
 *
 * Each source adapter implements the `DiscoverySource` interface and emits
 * normalized `DiscoveredCompany` objects to the normalization service.
 *
 * Phase 1 status: interface defined, no implementations.
 * =============================================================================
 */

export interface DiscoverySource {
  /** Stable identifier (e.g. "yc", "product_hunt") */
  readonly id: string;
  /** Human-readable name */
  readonly label: string;
  /** Poll interval in seconds (0 = manual only) */
  readonly pollIntervalSec: number;
  /** Discover new companies since the given cursor */
  discover(since: DiscoveryCursor): AsyncGenerator<DiscoveredCompany>;
}

export interface DiscoveryCursor {
  /** ISO timestamp of last successful discovery */
  lastRunAt: string;
  /** Source-specific cursor (e.g. HN item ID, PH post ID) */
  cursor?: string;
}

export interface DiscoveredCompany {
  /** Source-specific external ID */
  externalId: string;
  source: string;
  name: string;
  domain?: string;
  description?: string;
  foundedYear?: number;
  headquarters?: string;
  /** Raw payload from the source for audit/replay */
  raw: unknown;
  discoveredAt: string;
}

/**
 * Registry of discovery sources. Phase 2 will populate this.
 */
export const discoverySources: DiscoverySource[] = [];

/**
 * Run discovery across all sources.
 * Phase 2 implementation will:
 *  1. Load cursors from the database
 *  2. Iterate each source in parallel
 *  3. Publish each DiscoveredCompany to the normalization queue (RabbitMQ)
 *  4. Update cursors on success
 */
export async function runDiscovery(): Promise<void> {
  throw new Error("Not implemented — Phase 2");
}
