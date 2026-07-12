/**
 * AI Repository — data access for AI analysis, evidence, ICP config, cache, jobs
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AIAnalysisResult } from "./schema";

// ---------------------------------------------------------------------------
// AI Analysis
// ---------------------------------------------------------------------------

export const aiAnalysisRepository = {
  async create(companyId: string, promptHash: string, websiteHash: string, modelVersion: string) {
    // Delete previous analysis for this company (keep only latest)
    await db.aIAnalysis.deleteMany({ where: { companyId } });
    return db.aIAnalysis.create({
      data: {
        companyId,
        status: "processing",
        promptHash,
        websiteHash,
        modelVersion,
        promptVersion: "1.0.0",
      },
    });
  },

  async update(id: string, data: Prisma.AIAnalysisUpdateInput) {
    return db.aIAnalysis.update({ where: { id }, data });
  },

  async setResults(id: string, result: AIAnalysisResult, tokensUsed: number, durationMs: number) {
    await db.aIAnalysis.update({
      where: { id },
      data: {
        status: "completed",
        summaryOneLine: result.summaryOneLine,
        summaryParagraph: result.summaryParagraph,
        summaryDetailed: result.summaryDetailed,
        productCategory: result.productCategory,
        subCategory: result.subCategory,
        industry: result.industry,
        targetMarket: result.targetMarket,
        targetCustomer: result.targetCustomer,
        customerProfile: JSON.stringify(result.customerProfile),
        pricingModel: result.pricingModel,
        pricingEstimate: result.pricingEstimate,
        budgetCategory: result.budgetCategory,
        companyStage: result.companyStage,
        stageConfidence: result.stageConfidence,
        hiringStatus: result.hiringStatus,
        hiringTrend: result.hiringTrend,
        teamComposition: result.teamComposition,
        remoteFirst: result.remoteFirst,
        productMaturity: result.productMaturity,
        websiteVisualQuality: result.websiteQuality.visualQuality,
        websiteUX: result.websiteQuality.ux,
        websiteCopywriting: result.websiteQuality.copywriting,
        websiteBrand: result.websiteQuality.brand,
        websitePerformance: result.websiteQuality.performance,
        websiteProfessionalism: result.websiteQuality.professionalism,
        websiteModernity: result.websiteQuality.modernity,
        websiteOverall: result.websiteQuality.overall,
        videoProductVideo: result.videoOpportunity.productVideo,
        videoExplainer: result.videoOpportunity.explainer,
        videoHomepageAnimation: result.videoOpportunity.homepageAnimation,
        videoDemoVideo: result.videoOpportunity.demoVideo,
        videoLaunchTrailer: result.videoOpportunity.launchTrailer,
        videoOnboarding: result.videoOpportunity.onboarding,
        videoFeatureUpdates: result.videoOpportunity.featureUpdates,
        videoSocialContent: result.videoOpportunity.socialContent,
        videoOverall: result.videoOpportunity.overall,
        icpMatchPct: result.icpMatch.matchPct,
        icpReasons: JSON.stringify(result.icpMatch.reasons),
        icpMissingReqs: JSON.stringify(result.icpMatch.missingRequirements),
        icpStrengths: JSON.stringify(result.icpMatch.strengths),
        icpWeaknesses: JSON.stringify(result.icpMatch.weaknesses),
        qualificationScore: result.qualification.score,
        qualificationReasons: JSON.stringify(result.qualification.reasons),
        riskFactors: JSON.stringify(result.riskFactors),
        opportunityFactors: JSON.stringify(result.opportunityFactors),
        overallConfidence: result.overallConfidence,
        tokensUsed,
        durationMs,
        analyzedAt: new Date(),
      },
    });

    // Store evidence
    for (const ev of result.evidence) {
      await db.aIEvidence.create({
        data: {
          analysisId: id,
          field: ev.field,
          value: ev.value,
          confidence: ev.confidence,
          source: ev.source,
          evidence: ev.evidence,
          reasoning: ev.reasoning ?? null,
        },
      });
    }
  },

  async setFailed(id: string, error: string) {
    return db.aIAnalysis.update({
      where: { id },
      data: { status: "failed", errorMessage: error },
    });
  },

  findByCompanyId(companyId: string) {
    return db.aIAnalysis.findFirst({
      where: { companyId },
      include: { evidence: true },
      orderBy: { analyzedAt: "desc" },
    });
  },

  findLatest(limit: number = 20) {
    return db.aIAnalysis.findMany({
      where: { status: "completed" },
      orderBy: { analyzedAt: "desc" },
      take: limit,
      include: {
        company: { select: { id: true, name: true, domain: true, logoUrl: true } },
      },
    });
  },

  async search(query: string, limit: number = 20) {
    return db.aIAnalysis.findMany({
      where: {
        status: "completed",
        OR: [
          { summaryOneLine: { contains: query } },
          { summaryParagraph: { contains: query } },
          { summaryDetailed: { contains: query } },
          { productCategory: { contains: query } },
          { industry: { contains: query } },
          { company: { name: { contains: query } } },
          { company: { domain: { contains: query } } },
        ],
      },
      orderBy: { analyzedAt: "desc" },
      take: limit,
      include: {
        company: { select: { id: true, name: true, domain: true, logoUrl: true } },
      },
    });
  },

  async countCompleted() {
    return db.aIAnalysis.count({ where: { status: "completed" } });
  },

  async getStats() {
    const completed = await db.aIAnalysis.findMany({
      where: { status: "completed" },
      select: {
        icpMatchPct: true,
        qualificationScore: true,
        videoOverall: true,
        websiteOverall: true,
        overallConfidence: true,
        industry: true,
        productCategory: true,
        pricingModel: true,
        companyStage: true,
      },
    });

    if (completed.length === 0) {
      return {
        total: 0,
        avgIcpMatch: 0,
        avgQualification: 0,
        avgVideoOpportunity: 0,
        avgConfidence: 0,
        industries: [],
        categories: [],
      };
    }

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    const industries = new Map<string, number>();
    const categories = new Map<string, number>();
    for (const a of completed) {
      if (a.industry) industries.set(a.industry, (industries.get(a.industry) ?? 0) + 1);
      if (a.productCategory) categories.set(a.productCategory, (categories.get(a.productCategory) ?? 0) + 1);
    }

    return {
      total: completed.length,
      avgIcpMatch: Math.round(sum(completed.map((a) => a.icpMatchPct ?? 0)) / completed.length),
      avgQualification: Math.round(sum(completed.map((a) => a.qualificationScore ?? 0)) / completed.length),
      avgVideoOpportunity: Math.round(sum(completed.map((a) => a.videoOverall ?? 0)) / completed.length),
      avgConfidence: Math.round(sum(completed.map((a) => a.overallConfidence ?? 0)) / completed.length),
      industries: Array.from(industries.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      categories: Array.from(categories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    };
  },
};

// ---------------------------------------------------------------------------
// ICP Config
// ---------------------------------------------------------------------------

export const icpRepository = {
  async getActive() {
    const icp = await db.iCPConfig.findFirst({ where: { isActive: true } });
    if (icp) return icp;
    // Create default if none exists
    return db.iCPConfig.create({ data: { name: "Default ICP", isActive: true } });
  },

  async update(id: string, data: Partial<{
    name: string;
    industries: string[];
    categories: string[];
    targetMarkets: string[];
    minEmployees: number | null;
    maxEmployees: number | null;
    fundingStages: string[];
    hiringRoles: string[];
    pricingVisible: boolean;
    regions: string[];
  }>) {
    const updateData: Prisma.ICPConfigUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.industries !== undefined) updateData.industries = JSON.stringify(data.industries);
    if (data.categories !== undefined) updateData.categories = JSON.stringify(data.categories);
    if (data.targetMarkets !== undefined) updateData.targetMarkets = JSON.stringify(data.targetMarkets);
    if (data.minEmployees !== undefined) updateData.minEmployees = data.minEmployees;
    if (data.maxEmployees !== undefined) updateData.maxEmployees = data.maxEmployees;
    if (data.fundingStages !== undefined) updateData.fundingStages = JSON.stringify(data.fundingStages);
    if (data.hiringRoles !== undefined) updateData.hiringRoles = JSON.stringify(data.hiringRoles);
    if (data.pricingVisible !== undefined) updateData.pricingVisible = data.pricingVisible;
    if (data.regions !== undefined) updateData.regions = JSON.stringify(data.regions);
    return db.iCPConfig.update({ where: { id }, data: updateData });
  },

  deserialize(icp: {
    id: string;
    name: string;
    industries: string;
    categories: string;
    targetMarkets: string;
    minEmployees: number | null;
    maxEmployees: number | null;
    fundingStages: string;
    hiringRoles: string;
    pricingVisible: boolean;
    regions: string;
  }) {
    return {
      id: icp.id,
      name: icp.name,
      industries: safeJsonArray(icp.industries),
      categories: safeJsonArray(icp.categories),
      targetMarkets: safeJsonArray(icp.targetMarkets),
      minEmployees: icp.minEmployees,
      maxEmployees: icp.maxEmployees,
      fundingStages: safeJsonArray(icp.fundingStages),
      hiringRoles: safeJsonArray(icp.hiringRoles),
      pricingVisible: icp.pricingVisible,
      regions: safeJsonArray(icp.regions),
    };
  },
};

// ---------------------------------------------------------------------------
// Prompt Cache
// ---------------------------------------------------------------------------

export const promptCacheRepository = {
  async get(cacheKey: string) {
    return db.promptCache.findUnique({ where: { cacheKey } });
  },

  async set(cacheKey: string, companyId: string, promptHash: string, websiteHash: string, promptVersion: string, modelVersion: string, response: string, tokensUsed: number) {
    return db.promptCache.create({
      data: { cacheKey, companyId, promptHash, websiteHash, promptVersion, modelVersion, response, tokensUsed },
    });
  },

  async invalidateCompany(companyId: string) {
    return db.promptCache.deleteMany({ where: { companyId } });
  },
};

// ---------------------------------------------------------------------------
// AI Jobs
// ---------------------------------------------------------------------------

export const aiJobRepository = {
  create(companyId: string | null, batchId: string | null, type: string, total: number = 1) {
    return db.aIJob.create({
      data: { companyId, batchId, type, total, status: "QUEUED" },
    });
  },

  findById(id: string) {
    return db.aIJob.findUnique({ where: { id } });
  },

  findPending(limit: number = 3) {
    return db.aIJob.findMany({
      where: { status: { in: ["QUEUED", "RETRYING"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  },

  update(id: string, data: Prisma.AIJobUpdateInput) {
    return db.aIJob.update({ where: { id }, data });
  },

  setStatus(id: string, status: string, extra?: Prisma.AIJobUpdateInput) {
    return db.aIJob.update({ where: { id }, data: { status, ...extra } });
  },

  findStale(staleBefore: Date) {
    return db.aIJob.findMany({
      where: { status: "RUNNING", lastHeartbeat: { lt: staleBefore } },
    });
  },

  list(limit: number = 50) {
    return db.aIJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
