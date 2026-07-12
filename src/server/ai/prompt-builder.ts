/**
 * =============================================================================
 * Prompt Builder — constructs prompts from enriched company data
 * =============================================================================
 *
 * Builds a focused, token-efficient prompt that gives the LLM:
 *  - Company basics (name, domain, description)
 *  - Website content (title, H1, description, CTA)
 *  - Detected technologies
 *  - Pricing signals
 *  - Contact information
 *  - Social links
 *  - Navigation structure
 *  - ICP configuration (for matching)
 *
 * Never sends unnecessary text. Optimized for token usage.
 * =============================================================================
 */

import type { Company, ContentBlock, CompanyTechnology } from "@prisma/client";
import { createHash } from "node:crypto";

export interface PromptContext {
  company: {
    name: string;
    domain: string | null;
    website: string | null;
    description: string | null;
    industry: string | null;
    country: string | null;
    foundedYear: number | null;
    fundingStage: string | null;
    employeeEstimate: string | null;
    headline: string | null;
    pricingModel: string | null;
    pricingDetected: boolean;
    trialDetected: boolean;
    freemiumDetected: boolean;
    enterpriseDetected: boolean;
    callToAction: string | null;
    supportEmail: string | null;
    contactEmail: string | null;
    linkedinUrl: string | null;
    twitterUrl: string | null;
    websiteHttps: boolean | null;
    websiteStatus: number | null;
    websiteSpeedMs: number | null;
    enrichmentPages: number | null;
  };
  contentBlocks: Array<{ pageType: string; blockType: string; heading: string | null; content: string }>;
  technologies: Array<{ name: string; category: string }>;
  icp?: {
    industries: string[];
    categories: string[];
    targetMarkets: string[];
    minEmployees: number | null;
    maxEmployees: number | null;
    fundingStages: string[];
    hiringRoles: string[];
    pricingVisible: boolean;
    regions: string[];
  };
}

export const PROMPT_VERSION = "1.0.0";

/**
 * Build the system prompt — defines the AI's role and output format.
 */
export function buildSystemPrompt(): string {
  return `You are an expert B2B sales intelligence analyst. Your job is to analyze companies and produce structured intelligence reports.

CRITICAL RULES:
1. You MUST respond with valid JSON only. No markdown, no explanation outside JSON.
2. Every conclusion MUST include supporting evidence in the "evidence" array.
3. If you don't know something, return "Unknown" — never fabricate or guess.
4. All scores are 0-100 (higher = better).
5. Confidence scores are 0-100 (how sure you are based on available evidence).
6. Base your analysis ONLY on the provided data. Do not make assumptions beyond what's given.

The JSON must match this structure:
{
  "summaryOneLine": "one sentence summary",
  "summaryParagraph": "2-3 sentence summary",
  "summaryDetailed": "detailed paragraph summary",
  "productCategory": "category name",
  "subCategory": "sub-category",
  "industry": "industry name",
  "targetMarket": "target market description",
  "targetCustomer": "B2B|B2C|Marketplace|Developer Tool|AI|Healthcare|Fintech|Education|Infrastructure|Other",
  "customerProfile": {
    "whoBuys": "description of who buys",
    "decisionMaker": "Founder|CTO|Marketing|Engineering|Sales|Enterprise|SMB|Agencies|Unknown",
    "companySize": "size range"
  },
  "pricingModel": "Free|Freemium|Trial|Paid|Enterprise|Custom|Unknown",
  "pricingEstimate": "Low|Medium|High|Unknown",
  "budgetCategory": "< $100/mo|$100-$1k/mo|$1k-$10k/mo|$10k+/mo|Unknown",
  "companyStage": "Idea|Bootstrapped|Pre-seed|Seed|Series A|Series B+|Enterprise|Public|Unknown",
  "stageConfidence": 0-100,
  "hiringStatus": "Hiring|Not Hiring|Unknown",
  "hiringTrend": "Growing|Stable|Shrinking|Unknown",
  "teamComposition": "Engineering Heavy|Sales Heavy|Marketing Heavy|Balanced|Unknown",
  "remoteFirst": true/false,
  "productMaturity": "MVP|Growing|Established|Enterprise|Legacy|Unknown",
  "websiteQuality": { "visualQuality": 0-100, "ux": 0-100, "copywriting": 0-100, "brand": 0-100, "performance": 0-100, "professionalism": 0-100, "modernity": 0-100, "overall": 0-100 },
  "videoOpportunity": { "productVideo": 0-100, "explainer": 0-100, "homepageAnimation": 0-100, "demoVideo": 0-100, "launchTrailer": 0-100, "onboarding": 0-100, "featureUpdates": 0-100, "socialContent": 0-100, "overall": 0-100 },
  "icpMatch": { "matchPct": 0-100, "reasons": ["..."], "missingRequirements": ["..."], "strengths": ["..."], "weaknesses": ["..."] },
  "qualification": { "score": 0-100, "reasons": ["..."] },
  "riskFactors": ["..."],
  "opportunityFactors": ["..."],
  "overallConfidence": 0-100,
  "evidence": [{ "field": "fieldName", "value": "theValue", "confidence": 0-100, "source": "homepage|pricing|about|tech|meta", "evidence": "what was found", "reasoning": "why this conclusion" }]
}

For the evidence array, include an entry for every major conclusion (productCategory, pricingModel, companyStage, hiringStatus, websiteQuality.overall, videoOpportunity.overall, icpMatch.matchPct, qualification.score).`;
}

/**
 * Build the user prompt — contains the actual company data.
 */
export function buildUserPrompt(ctx: PromptContext): string {
  const parts: string[] = [];

  parts.push("Analyze this company and return JSON:\n");

  // Company basics
  parts.push("## Company");
  parts.push(`Name: ${ctx.company.name}`);
  if (ctx.company.domain) parts.push(`Domain: ${ctx.company.domain}`);
  if (ctx.company.website) parts.push(`Website: ${ctx.company.website}`);
  if (ctx.company.headline) parts.push(`Headline: ${ctx.company.headline}`);
  if (ctx.company.description) parts.push(`Description: ${ctx.company.description.slice(0, 500)}`);
  if (ctx.company.industry) parts.push(`Industry: ${ctx.company.industry}`);
  if (ctx.company.country) parts.push(`Country: ${ctx.company.country}`);
  if (ctx.company.foundedYear) parts.push(`Founded: ${ctx.company.foundedYear}`);
  if (ctx.company.fundingStage) parts.push(`Funding: ${ctx.company.fundingStage}`);
  if (ctx.company.employeeEstimate) parts.push(`Employees: ${ctx.company.employeeEstimate}`);
  if (ctx.company.callToAction) parts.push(`CTA: ${ctx.company.callToAction}`);

  // Pricing signals
  const pricingSignals: string[] = [];
  if (ctx.company.pricingDetected) pricingSignals.push("Pricing page detected");
  if (ctx.company.trialDetected) pricingSignals.push("Free trial detected");
  if (ctx.company.freemiumDetected) pricingSignals.push("Freemium detected");
  if (ctx.company.enterpriseDetected) pricingSignals.push("Enterprise pricing detected");
  if (ctx.company.pricingModel) pricingSignals.push(`Model: ${ctx.company.pricingModel}`);
  if (pricingSignals.length > 0) parts.push(`Pricing: ${pricingSignals.join(", ")}`);

  // Contact
  const contact: string[] = [];
  if (ctx.company.supportEmail) contact.push(`Support: ${ctx.company.supportEmail}`);
  if (ctx.company.contactEmail) contact.push(`Contact: ${ctx.company.contactEmail}`);
  if (ctx.company.linkedinUrl) contact.push(`LinkedIn: ${ctx.company.linkedinUrl}`);
  if (ctx.company.twitterUrl) contact.push(`Twitter: ${ctx.company.twitterUrl}`);
  if (contact.length > 0) parts.push(`Contact: ${contact.join(", ")}`);

  // Website health
  const health: string[] = [];
  if (ctx.company.websiteHttps !== null) health.push(`HTTPS: ${ctx.company.websiteHttps ? "Yes" : "No"}`);
  if (ctx.company.websiteStatus) health.push(`Status: ${ctx.company.websiteStatus}`);
  if (ctx.company.websiteSpeedMs) health.push(`Speed: ${ctx.company.websiteSpeedMs}ms`);
  if (ctx.company.enrichmentPages) health.push(`Pages crawled: ${ctx.company.enrichmentPages}`);
  if (health.length > 0) parts.push(`Website: ${health.join(", ")}`);

  // Technologies
  if (ctx.technologies.length > 0) {
    const techByCategory = new Map<string, string[]>();
    for (const tech of ctx.technologies) {
      const cat = tech.category;
      if (!techByCategory.has(cat)) techByCategory.set(cat, []);
      techByCategory.get(cat)!.push(tech.name);
    }
    const techLines: string[] = [];
    for (const [cat, techs] of techByCategory) {
      techLines.push(`  ${cat}: ${techs.join(", ")}`);
    }
    parts.push(`Technologies:\n${techLines.join("\n")}`);
  }

  // Content blocks (limited for token efficiency)
  if (ctx.contentBlocks.length > 0) {
    const blocks = ctx.contentBlocks.slice(0, 15); // cap at 15 blocks
    const blockLines = blocks.map((b) =>
      `  [${b.pageType}] ${b.blockType}: ${b.heading ? b.heading + " — " : ""}${b.content.slice(0, 200)}`
    );
    parts.push(`Content:\n${blockLines.join("\n")}`);
  }

  // ICP configuration
  if (ctx.icp) {
    parts.push("## ICP Configuration (match against this)");
    if (ctx.icp.industries.length > 0) parts.push(`Industries: ${ctx.icp.industries.join(", ")}`);
    if (ctx.icp.categories.length > 0) parts.push(`Categories: ${ctx.icp.categories.join(", ")}`);
    if (ctx.icp.targetMarkets.length > 0) parts.push(`Target markets: ${ctx.icp.targetMarkets.join(", ")}`);
    if (ctx.icp.minEmployees || ctx.icp.maxEmployees) {
      parts.push(`Employees: ${ctx.icp.minEmployees ?? 0}-${ctx.icp.maxEmployees ?? "any"}`);
    }
    if (ctx.icp.fundingStages.length > 0) parts.push(`Funding stages: ${ctx.icp.fundingStages.join(", ")}`);
    if (ctx.icp.hiringRoles.length > 0) parts.push(`Hiring roles: ${ctx.icp.hiringRoles.join(", ")}`);
    parts.push(`Pricing visible required: ${ctx.icp.pricingVisible ? "Yes" : "No"}`);
    if (ctx.icp.regions.length > 0) parts.push(`Regions: ${ctx.icp.regions.join(", ")}`);
  }

  parts.push("\nReturn ONLY valid JSON. No markdown fences, no explanation.");

  return parts.join("\n");
}

/**
 * Compute a hash of the prompt for caching.
 */
export function hashPrompt(systemPrompt: string, userPrompt: string): string {
  return createHash("sha256")
    .update(`${systemPrompt}\n---\n${userPrompt}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Compute a hash of the company's website content for cache invalidation.
 */
export function hashWebsiteContent(ctx: PromptContext): string {
  const parts = [
    ctx.company.description ?? "",
    ctx.company.headline ?? "",
    ctx.company.pricingModel ?? "",
    JSON.stringify(ctx.technologies.map((t) => t.name).sort()),
    JSON.stringify(ctx.contentBlocks.map((b) => b.content).sort()),
  ];
  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 32);
}
