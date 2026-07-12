/**
 * =============================================================================
 * Leadforge — Deduplication Service (Phase 2)
 * =============================================================================
 *
 * Prevents the same real-world company from appearing multiple times in
 * the database (e.g. discovered from both YC and Product Hunt).
 *
 * Match signals (any one triggers a fuzzy compare):
 *  - apex domain match (strong)
 *  - normalized company name exact match (strong)
 *  - fuzzy name similarity > 0.92 (weak, requires human review flag)
 *  - website root URL match (strong)
 *
 * On match: merge into the existing company, append the new source to
 * Source[], and update lastSeenAt. Never overwrite enriched fields.
 *
 * Phase 1 status: interface defined, no implementation.
 * =============================================================================
 */

import type { NormalizedCompany } from "../../services/normalization/src";

export interface DedupResult {
  /** The ID of the existing company if a match was found */
  existingCompanyId?: string;
  /** True if this is a new company */
  isNew: boolean;
  /** Confidence 0-1 that the match is correct */
  matchConfidence?: number;
  /** Reason for the match (for audit) */
  matchReason?: string;
}

export function deduplicate(
  input: NormalizedCompany,
  existing: NormalizedCompany[]
): DedupResult {
  throw new Error("Not implemented — Phase 2");
}
