/**
 * GET /api/v1/ai/insights/:companyId
 * Get AI analysis for a company.
 */

import { aiAnalysisRepository } from "@/server/repositories/ai.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const analysis = await aiAnalysisRepository.findByCompanyId(id);
    if (!analysis) {
      return apiSuccess({ analysis: null, message: "No analysis yet" }, { requestId: ctx.requestId });
    }
    return apiSuccess({ analysis: serializeAnalysis(analysis as unknown as Record<string, unknown>) }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

function serializeAnalysis(a: Record<string, unknown>) {
  return {
    id: a.id,
    companyId: a.companyId,
    status: a.status,
    promptVersion: a.promptVersion,
    modelVersion: a.modelVersion,
    summaryOneLine: a.summaryOneLine,
    summaryParagraph: a.summaryParagraph,
    summaryDetailed: a.summaryDetailed,
    productCategory: a.productCategory,
    subCategory: a.subCategory,
    industry: a.industry,
    targetMarket: a.targetMarket,
    targetCustomer: a.targetCustomer,
    customerProfile: safeJson(a.customerProfile as string),
    pricingModel: a.pricingModel,
    pricingEstimate: a.pricingEstimate,
    budgetCategory: a.budgetCategory,
    companyStage: a.companyStage,
    stageConfidence: a.stageConfidence,
    hiringStatus: a.hiringStatus,
    hiringTrend: a.hiringTrend,
    teamComposition: a.teamComposition,
    remoteFirst: a.remoteFirst,
    productMaturity: a.productMaturity,
    websiteQuality: {
      visualQuality: a.websiteVisualQuality,
      ux: a.websiteUX,
      copywriting: a.websiteCopywriting,
      brand: a.websiteBrand,
      performance: a.websitePerformance,
      professionalism: a.websiteProfessionalism,
      modernity: a.websiteModernity,
      overall: a.websiteOverall,
    },
    videoOpportunity: {
      productVideo: a.videoProductVideo,
      explainer: a.videoExplainer,
      homepageAnimation: a.videoHomepageAnimation,
      demoVideo: a.videoDemoVideo,
      launchTrailer: a.videoLaunchTrailer,
      onboarding: a.videoOnboarding,
      featureUpdates: a.videoFeatureUpdates,
      socialContent: a.videoSocialContent,
      overall: a.videoOverall,
    },
    icpMatch: {
      matchPct: a.icpMatchPct,
      reasons: safeJsonArray(a.icpReasons as string),
      missingRequirements: safeJsonArray(a.icpMissingReqs as string),
      strengths: safeJsonArray(a.icpStrengths as string),
      weaknesses: safeJsonArray(a.icpWeaknesses as string),
    },
    qualification: {
      score: a.qualificationScore,
      reasons: safeJsonArray(a.qualificationReasons as string),
    },
    riskFactors: safeJsonArray(a.riskFactors as string),
    opportunityFactors: safeJsonArray(a.opportunityFactors as string),
    overallConfidence: a.overallConfidence,
    tokensUsed: a.tokensUsed,
    durationMs: a.durationMs,
    errorMessage: a.errorMessage,
    analyzedAt: a.analyzedAt,
    evidence: (a.evidence as Array<Record<string, unknown>> | undefined)?.map((e) => ({
      field: e.field,
      value: e.value,
      confidence: e.confidence,
      source: e.source,
      evidence: e.evidence,
      reasoning: e.reasoning,
    })),
  };
}

function safeJson(s: string | null | undefined): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
