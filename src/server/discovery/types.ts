/**
 * =============================================================================
 * Leadforge — Discovery Engine Core Types
 * =============================================================================
 *
 * Every discovery source implements the `DiscoverySource` interface. The
 * worker calls `discover()` to iterate raw results, then passes each
 * result through `normalize()` → `validate()` before storage.
 *
 * No source-specific data structures leak past this module. The rest of
 * the application only sees `NormalizedCompany`.
 * =============================================================================
 */

import type { SourceType } from "@prisma/client";

/**
 * Raw company as returned by a source adapter. Shape varies per source —
 * this is the union of all fields any adapter might populate.
 */
export interface RawCompany {
  /** Source-specific external ID (e.g. HN item ID, PH post ID) */
  externalId: string;
  source: SourceType;
  name: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  industry?: string;
  country?: string;
  headquarters?: string;
  foundedYear?: number;
  fundingStage?: string;
  employeeEstimate?: string;
  tags?: string[];
  /** Launch/discovery URL on the source site */
  sourceUrl?: string;
  /** When the company was first seen on this source */
  publishedAt?: string;
  /** Original raw payload from the source (for audit/replay) */
  raw: unknown;
}

/**
 * Canonical company shape — the only structure the rest of the app sees.
 * Produced by the normalizer from a `RawCompany`.
 */
export interface NormalizedCompany {
  name: string;
  website?: string;
  domain?: string;
  apexDomain?: string;
  description?: string;
  logoUrl?: string;
  industry?: string;
  country?: string;
  headquarters?: string;
  foundedYear?: number;
  fundingStage?: string;
  employeeEstimate?: string;
  tags: string[];
  source: SourceType;
  sourceExternalId: string;
  sourceUrl?: string;
  publishedAt?: string;
  raw: unknown;
}

/**
 * Validation result — the validator decides whether to accept, reject,
 * or flag a company.
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  /** "spam" | "duplicate" | "incomplete" | "malformed" */
  reasonCode?: "spam" | "duplicate" | "incomplete" | "malformed" | "blocked_tld";
}

/**
 * The interface every discovery source must implement.
 *
 * Adding a new source = creating a new file in `/sources/`, implementing
 * this interface, and registering it in the source registry. No existing
 * code needs to change.
 */
export interface DiscoverySource {
  /** Stable identifier matching the `SourceType` enum */
  readonly id: SourceType;
  /** Human-readable name */
  readonly label: string;
  /** Max requests per second (0 = unlimited) */
  readonly rateLimitPerSec: number;
  /** Default page size */
  readonly defaultPageSize: number;

  /**
   * Discover raw companies from the source.
   *
   * Yields `RawCompany` objects one at a time so the worker can process
   * them incrementally (store, dedup, log) without buffering everything
   * in memory.
   *
   * @param params Discovery parameters (filters, limits, cursor)
   * @param ctx Callbacks for the worker to report progress and check cancellation
   */
  discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void>;
}

/**
 * Parameters passed to each source adapter.
 * Derived from the user's DiscoveryJob configuration.
 */
export interface DiscoveryParams {
  /** Maximum companies to discover across all sources */
  maxCompanies: number;
  /** Filter by keywords (search query) */
  keywords: string[];
  /** Filter by category/industry */
  categories: string[];
  /** Filter by region/country */
  regions: string[];
  /** Filter by funding stage */
  fundingStages: string[];
  /** Only return companies that are hiring */
  hiringOnly: boolean;
  /** Date range filter */
  dateFrom?: Date;
  dateTo?: Date;
  /** Per-source page limit (safety cap) */
  maxPages: number;
}

/**
 * Context passed to each source adapter — callbacks for progress,
 * cancellation, and logging.
 */
export interface DiscoveryContext {
  jobId: string;
  /** Called after each company is yielded — return false to stop */
  shouldContinue: () => boolean;
  /** Log a message to the job's log */
  log: (level: "debug" | "info" | "warn" | "error", message: string, metadata?: Record<string, unknown>) => void;
  /** Update progress on the job */
  updateProgress: (progress: Partial<DiscoveryProgress>) => void;
  /** Sleep that respects cancellation (use instead of setTimeout) */
  sleep: (ms: number) => Promise<void>;
}

export interface DiscoveryProgress {
  currentSource: string;
  currentPage: number;
  totalPages: number;
  companiesFound: number;
  companiesStored: number;
  duplicatesFound: number;
  errorsCount: number;
  retriesCount: number;
}

/**
 * Worker heartbeat — stored on the job so the UI can show liveness.
 */
export interface WorkerHeartbeat {
  jobId: string;
  workerId: string;
  timestamp: Date;
  currentSource?: string;
  currentPage?: number;
  companiesFound: number;
}
