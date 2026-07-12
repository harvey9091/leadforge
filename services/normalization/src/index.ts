/**
 * =============================================================================
 * Leadforge — Normalization Service (Phase 2)
 * =============================================================================
 *
 * Converts every discovered company into a single canonical schema.
 *
 * Responsibilities:
 *  - Lowercase + trim domains
 *  - Extract root domain (strip www., subdomains)
 *  - Normalize company names (strip "Inc.", "Ltd.", trailing whitespace)
 *  - Parse ISO dates from various source formats
 *  - Map source-specific categories to the canonical industry taxonomy
 *
 * Input: DiscoveredCompany (raw, source-specific)
 * Output: NormalizedCompany (canonical, dedup-ready)
 *
 * Phase 1 status: interface defined, no implementation.
 * =============================================================================
 */

import type { DiscoveredCompany } from "../../services/discovery/src";

export interface NormalizedCompany {
  name: string;
  legalName?: string;
  domain?: string;
  apexDomain?: string;
  description?: string;
  foundedYear?: number;
  headquarters?: string;
  industry?: string;
  sourceType: string;
  sourceExternalId: string;
  raw: unknown;
  normalizedAt: string;
}

export function normalize(input: DiscoveredCompany): NormalizedCompany {
  throw new Error("Not implemented — Phase 2");
}
