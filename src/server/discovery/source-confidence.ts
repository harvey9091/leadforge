/**
 * =============================================================================
 * Source Confidence
 * =============================================================================
 *
 * Every source gets a confidence value (0-100). Higher = more trustworthy.
 *
 * Default values (from the architecture spec):
 *   YC:            98
 *   Product Hunt:  90
 *   Hacker News:   84
 *   BetaList:      72
 *   DevHunt:       70
 *   Uneed:         68
 *
 * Multiple discoveries from different sources increase the effective
 * confidence of a company. The confidence is stored on each Source record
 * and contributes to the company's overall trust score.
 * =============================================================================
 */

import type { SourceType } from "@prisma/client";

export const SOURCE_CONFIDENCE: Record<string, number> = {
  YC: 98,
  PRODUCT_HUNT: 90,
  HACKER_NEWS: 84,
  BETALIST: 72,
  DEVHUNT: 70,
  UNEED: 68,
  SEC_EDGAR: 95,
  GREENHOUSE: 60,
  LEVER: 60,
  ASHBY: 60,
  MANUAL: 100,
  API: 80,
};

/**
 * Get the confidence value for a source type.
 * Falls back to 50 for unknown sources.
 */
export function getSourceConfidence(sourceType: string): number {
  return SOURCE_CONFIDENCE[sourceType] ?? 50;
}

/**
 * Calculate the effective confidence of a company based on all its sources.
 * Multiple sources = higher confidence.
 *
 * Formula: base confidence of the highest source + bonus for each additional
 * source, capped at 100.
 */
export function calculateCompanyConfidence(sources: Array<{ type: string }>): number {
  if (sources.length === 0) return 0;

  const confidences = sources.map((s) => getSourceConfidence(s.type));
  const max = Math.max(...confidences);
  const bonus = Math.min(20, (sources.length - 1) * 5); // +5 per additional source, max +20
  return Math.min(100, max + bonus);
}
