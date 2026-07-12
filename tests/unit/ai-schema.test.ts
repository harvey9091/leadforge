import { describe, it, expect } from "vitest";
import { safeValidateAIAnalysis, type AIAnalysisResult } from "@/server/ai/schema";

describe("AI analysis schema validation", () => {
  const validResult: AIAnalysisResult = {
    summaryOneLine: "A SaaS tool for developers",
    summaryParagraph: "Acme helps developers build better software with automated testing and CI/CD integration.",
    summaryDetailed: "Acme is a developer tools company that provides a comprehensive platform for software testing and deployment automation. Their product integrates with popular CI/CD pipelines and offers features like automated test generation, performance monitoring, and deployment analytics.",
    productCategory: "Developer Tools",
    subCategory: "Testing",
    industry: "Software Development",
    targetMarket: "B2B SaaS companies",
    targetCustomer: "B2B",
    customerProfile: {
      whoBuys: "Engineering teams at SaaS companies",
      decisionMaker: "CTO",
      companySize: "50-500 employees",
    },
    pricingModel: "Freemium",
    pricingEstimate: "Medium",
    budgetCategory: "$100-$1k/mo",
    companyStage: "Seed",
    stageConfidence: 75,
    hiringStatus: "Hiring",
    hiringTrend: "Growing",
    teamComposition: "Engineering Heavy",
    remoteFirst: true,
    productMaturity: "Growing",
    websiteQuality: {
      visualQuality: 80,
      ux: 75,
      copywriting: 85,
      brand: 70,
      performance: 90,
      professionalism: 80,
      modernity: 85,
      overall: 80,
    },
    videoOpportunity: {
      productVideo: 70,
      explainer: 80,
      homepageAnimation: 60,
      demoVideo: 85,
      launchTrailer: 50,
      onboarding: 75,
      featureUpdates: 65,
      socialContent: 55,
      overall: 67,
    },
    icpMatch: {
      matchPct: 85,
      reasons: ["Matches Developer Tools industry", "B2B target customer", "Seed stage"],
      missingRequirements: ["North America region not confirmed"],
      strengths: ["Strong engineering team", "Clear pricing"],
      weaknesses: ["Limited funding information"],
    },
    qualification: {
      score: 78,
      reasons: ["High ICP match", "Growing hiring", "Clear product market fit"],
    },
    riskFactors: ["Early stage company", "Limited funding data"],
    opportunityFactors: ["Growing market", "Strong technology stack"],
    overallConfidence: 82,
    evidence: [
      {
        field: "productCategory",
        value: "Developer Tools",
        confidence: 95,
        source: "homepage",
        evidence: "Homepage mentions 'developer tools' and 'CI/CD integration'",
        reasoning: "The homepage clearly positions this as a developer tools product",
      },
      {
        field: "pricingModel",
        value: "Freemium",
        confidence: 90,
        source: "pricing",
        evidence: "Pricing page shows free tier and paid plans",
        reasoning: "Free tier with paid upgrades indicates freemium model",
      },
    ],
  };

  it("accepts a valid AI analysis result", () => {
    const result = safeValidateAIAnalysis(validResult);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summaryOneLine).toBe("A SaaS tool for developers");
      expect(result.data.icpMatch.matchPct).toBe(85);
      expect(result.data.evidence).toHaveLength(2);
    }
  });

  it("rejects missing required fields", () => {
    const invalid = { ...validResult, summaryOneLine: undefined } as unknown as AIAnalysisResult;
    const result = safeValidateAIAnalysis(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid enum values", () => {
    const invalid = { ...validResult, targetCustomer: "InvalidValue" } as unknown as AIAnalysisResult;
    const result = safeValidateAIAnalysis(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects scores outside 0-100 range", () => {
    const invalid = {
      ...validResult,
      websiteQuality: { ...validResult.websiteQuality, visualQuality: 150 },
    } as AIAnalysisResult;
    const result = safeValidateAIAnalysis(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside 0-100 range", () => {
    const invalid = {
      ...validResult,
      evidence: [{ ...validResult.evidence[0]!, confidence: 150 }],
    } as AIAnalysisResult;
    const result = safeValidateAIAnalysis(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts Unknown as a valid enum value", () => {
    const withUnknown = {
      ...validResult,
      pricingModel: "Unknown",
      companyStage: "Unknown",
      hiringStatus: "Unknown",
    } as AIAnalysisResult;
    const result = safeValidateAIAnalysis(withUnknown);
    expect(result.success).toBe(true);
  });

  it("rejects empty evidence array is allowed (not required to be non-empty)", () => {
    const withEmptyEvidence = {
      ...validResult,
      evidence: [],
    } as AIAnalysisResult;
    const result = safeValidateAIAnalysis(withEmptyEvidence);
    expect(result.success).toBe(true);
  });
});
