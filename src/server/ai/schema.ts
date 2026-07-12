/**
 * =============================================================================
 * AI Analysis Schema — structured output from FreeLLM
 * =============================================================================
 *
 * Every LLM response MUST conform to this schema. No free text is accepted.
 * The validator rejects malformed output and retries automatically.
 * =============================================================================
 */

import { z } from "zod";

export const aiAnalysisSchema = z.object({
  // Business intelligence
  summaryOneLine: z.string().max(200),
  summaryParagraph: z.string().max(500),
  summaryDetailed: z.string().max(2000),
  productCategory: z.string(),
  subCategory: z.string(),
  industry: z.string(),
  targetMarket: z.string(),
  targetCustomer: z.enum([
    "B2B", "B2C", "Marketplace", "Developer Tool", "AI",
    "Healthcare", "Fintech", "Education", "Infrastructure", "Other",
  ]),
  customerProfile: z.object({
    whoBuys: z.string(),
    decisionMaker: z.enum([
      "Founder", "CTO", "Marketing", "Engineering", "Sales",
      "Enterprise", "SMB", "Agencies", "Unknown",
    ]),
    companySize: z.string(),
  }),

  // Pricing intelligence
  pricingModel: z.enum([
    "Free", "Freemium", "Trial", "Paid", "Enterprise", "Custom", "Unknown",
  ]),
  pricingEstimate: z.enum(["Low", "Medium", "High", "Unknown"]),
  budgetCategory: z.enum(["< $100/mo", "$100-$1k/mo", "$1k-$10k/mo", "$10k+/mo", "Unknown"]),

  // Company stage
  companyStage: z.enum([
    "Idea", "Bootstrapped", "Pre-seed", "Seed",
    "Series A", "Series B+", "Enterprise", "Public", "Unknown",
  ]),
  stageConfidence: z.number().int().min(0).max(100),

  // Hiring intelligence
  hiringStatus: z.enum(["Hiring", "Not Hiring", "Unknown"]),
  hiringTrend: z.enum(["Growing", "Stable", "Shrinking", "Unknown"]),
  teamComposition: z.enum([
    "Engineering Heavy", "Sales Heavy", "Marketing Heavy",
    "Balanced", "Unknown",
  ]),
  remoteFirst: z.boolean(),

  // Product maturity
  productMaturity: z.enum([
    "MVP", "Growing", "Established", "Enterprise", "Legacy", "Unknown",
  ]),

  // Website quality (0-100)
  websiteQuality: z.object({
    visualQuality: z.number().int().min(0).max(100),
    ux: z.number().int().min(0).max(100),
    copywriting: z.number().int().min(0).max(100),
    brand: z.number().int().min(0).max(100),
    performance: z.number().int().min(0).max(100),
    professionalism: z.number().int().min(0).max(100),
    modernity: z.number().int().min(0).max(100),
    overall: z.number().int().min(0).max(100),
  }),

  // Video opportunity scores (0-100)
  videoOpportunity: z.object({
    productVideo: z.number().int().min(0).max(100),
    explainer: z.number().int().min(0).max(100),
    homepageAnimation: z.number().int().min(0).max(100),
    demoVideo: z.number().int().min(0).max(100),
    launchTrailer: z.number().int().min(0).max(100),
    onboarding: z.number().int().min(0).max(100),
    featureUpdates: z.number().int().min(0).max(100),
    socialContent: z.number().int().min(0).max(100),
    overall: z.number().int().min(0).max(100),
  }),

  // ICP match (calculated by AI based on provided ICP config)
  icpMatch: z.object({
    matchPct: z.number().int().min(0).max(100),
    reasons: z.array(z.string()),
    missingRequirements: z.array(z.string()),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  }),

  // Qualification score
  qualification: z.object({
    score: z.number().int().min(0).max(100),
    reasons: z.array(z.string()),
  }),

  // Risk + Opportunity
  riskFactors: z.array(z.string()),
  opportunityFactors: z.array(z.string()),

  // Overall confidence
  overallConfidence: z.number().int().min(0).max(100),

  // Evidence — every conclusion must cite evidence
  evidence: z.array(
    z.object({
      field: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]).transform((v) => String(v)),
      confidence: z.number().min(0).max(100),
      source: z.string(),
      evidence: z.string(),
      reasoning: z.string().optional(),
    })
  ),
});

export type AIAnalysisResult = z.infer<typeof aiAnalysisSchema>;

/**
 * Validate an AI analysis result. Returns the parsed data or throws.
 */
export function validateAIAnalysis(data: unknown): AIAnalysisResult {
  return aiAnalysisSchema.parse(data);
}

/**
 * Safely validate — returns { success, data } or { success, error }.
 */
export function safeValidateAIAnalysis(data: unknown):
  | { success: true; data: AIAnalysisResult }
  | { success: false; error: string } {
  const result = aiAnalysisSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    success: false,
    error: firstError
      ? `${firstError.path.join(".")}: ${firstError.message}`
      : "Validation failed",
  };
}
