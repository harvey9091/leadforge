/**
 * =============================================================================
 * Leadforge — Scoring Service (Phase 2)
 * =============================================================================
 *
 * Computes a weighted lead score for each company based on multiple signals.
 *
 * Score dimensions (per Architecture v1.0):
 *  - ICP fit           (weight: 0.25)
 *  - company maturity  (weight: 0.15)
 *  - pricing availability (weight: 0.10)
 *  - hiring signal     (weight: 0.15)
 *  - funding signal    (weight: 0.15)
 *  - launch recency    (weight: 0.10)
 *  - website quality   (weight: 0.05)
 *  - video opportunity (weight: 0.05)
 *
 * Output: integer 0-100 + letter grade A/B/C/D/F.
 *  - A: 90-100  (immediate outreach)
 *  - B: 80-89   (this week)
 *  - C: 70-79   (this month)
 *  - D: 60-69   (nurture)
 *  - F: <60     (disqualified)
 *
 * Phase 1 status: schema + grade boundaries defined, computation is Phase 2.
 * =============================================================================
 */

export interface ScoreInput {
  icpFit: number;
  maturity: number;
  pricingAvailability: number;
  hiring: number;
  funding: number;
  launchRecency: number;
  websiteQuality: number;
  videoOpportunity: number;
}

export interface ScoreResult {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: ScoreInput;
  /** Human-readable explanation for the score */
  reason: string;
}

const WEIGHTS: ScoreInput = {
  icpFit: 0.25,
  maturity: 0.15,
  pricingAvailability: 0.10,
  hiring: 0.15,
  funding: 0.15,
  launchRecency: 0.10,
  websiteQuality: 0.05,
  videoOpportunity: 0.05,
};

export function computeScore(input: ScoreInput): ScoreResult {
  const overall = Math.round(
    input.icpFit * WEIGHTS.icpFit +
    input.maturity * WEIGHTS.maturity +
    input.pricingAvailability * WEIGHTS.pricingAvailability +
    input.hiring * WEIGHTS.hiring +
    input.funding * WEIGHTS.funding +
    input.launchRecency * WEIGHTS.launchRecency +
    input.websiteQuality * WEIGHTS.websiteQuality +
    input.videoOpportunity * WEIGHTS.videoOpportunity
  );

  const grade: ScoreResult["grade"] =
    overall >= 90 ? "A" :
    overall >= 80 ? "B" :
    overall >= 70 ? "C" :
    overall >= 60 ? "D" : "F";

  return {
    overall,
    grade,
    breakdown: input,
    reason: `Weighted score: ${overall}/100 (${grade})`,
  };
}
