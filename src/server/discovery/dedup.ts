/**
 * =============================================================================
 * Discovery Deduplication
 * =============================================================================
 *
 * Prevents the same real-world company from appearing multiple times.
 *
 * Match priority:
 *  1. Apex domain match (strongest — same website = same company)
 *  2. Full domain match (exact subdomain)
 *  3. Normalized name exact match (case-insensitive)
 *  4. Fuzzy name similarity > 0.88 (Levenshtein-based)
 *
 * On match: merge the new source into the existing company's source list,
 * update lastSeenAt, and optionally fill in missing fields.
 * =============================================================================
 */

import type { NormalizedCompany } from "./types";
import { normalizeName } from "./normalizer";

export interface DedupResult {
  /** True if this is a new company (no match found) */
  isNew: boolean;
  /** The ID of the existing company if matched */
  existingCompanyId?: string;
  /** Confidence 0-1 that the match is correct */
  confidence: number;
  /** Which match strategy was used */
  matchStrategy: "apex_domain" | "domain" | "name_exact" | "name_fuzzy" | "none";
  /** Reason for the match (for logging) */
  reason: string;
}

/** Threshold for fuzzy name matching */
const FUZZY_THRESHOLD = 0.88;

/**
 * Find a match for a normalized company among existing companies.
 *
 * @param company The new company to check
 * @param existing Array of existing companies to search (from DB)
 */
export function findDuplicate(
  company: NormalizedCompany,
  existing: ExistingCompany[]
): DedupResult {
  // 1. Apex domain match
  if (company.apexDomain) {
    const match = existing.find(
      (e) => e.apexDomain && e.apexDomain.toLowerCase() === company.apexDomain!.toLowerCase()
    );
    if (match) {
      return {
        isNew: false,
        existingCompanyId: match.id,
        confidence: 0.98,
        matchStrategy: "apex_domain",
        reason: `Apex domain match: ${company.apexDomain}`,
      };
    }
  }

  // 2. Full domain match
  if (company.domain) {
    const match = existing.find(
      (e) => e.domain && e.domain.toLowerCase() === company.domain!.toLowerCase()
    );
    if (match) {
      return {
        isNew: false,
        existingCompanyId: match.id,
        confidence: 0.95,
        matchStrategy: "domain",
        reason: `Domain match: ${company.domain}`,
      };
    }
  }

  // 3. Normalized name exact match (case-insensitive)
  const normalizedName = normalizeName(company.name).toLowerCase();
  if (normalizedName) {
    const match = existing.find(
      (e) => e.nameNormalized.toLowerCase() === normalizedName
    );
    if (match) {
      return {
        isNew: false,
        existingCompanyId: match.id,
        confidence: 0.85,
        matchStrategy: "name_exact",
        reason: `Name match: ${company.name}`,
      };
    }
  }

  // 4. Fuzzy name match
  if (normalizedName && normalizedName.length >= 4) {
    let bestMatch: ExistingCompany | undefined;
    let bestScore = 0;
    for (const e of existing) {
      const score = similarity(normalizedName, e.nameNormalized.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestMatch = e;
      }
    }
    if (bestMatch && bestScore >= FUZZY_THRESHOLD) {
      return {
        isNew: false,
        existingCompanyId: bestMatch.id,
        confidence: bestScore,
        matchStrategy: "name_fuzzy",
        reason: `Fuzzy name match (${(bestScore * 100).toFixed(0)}%): ${bestMatch.name}`,
      };
    }
  }

  return {
    isNew: true,
    confidence: 1,
    matchStrategy: "none",
    reason: "No match found",
  };
}

/**
 * Existing company shape (minimal fields needed for dedup).
 */
export interface ExistingCompany {
  id: string;
  name: string;
  nameNormalized: string;
  domain?: string | null;
  apexDomain?: string | null;
}

/**
 * Levenshtein distance-based similarity ratio (0-1).
 * 1 = identical, 0 = completely different.
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const dist = levenshtein(shorter, longer);
  return (longer.length - dist) / longer.length;
}

/**
 * Levenshtein edit distance.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }

  return prev[n]!;
}
