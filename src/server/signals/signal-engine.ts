/**
 * =============================================================================
 * Signal Engine — Phase 7
 * =============================================================================
 *
 * Detects buying signals from enrichment data, AI analysis, and crawl changes.
 * Each signal has a type, importance score, confidence, evidence, and timestamp.
 *
 * Signal types:
 *  - product_launch, pricing_change, new_feature, hiring_increase, funding_announcement
 *  - team_growth, homepage_redesign, new_integration, changelog_update, docs_growth
 *  - new_blog_post, security_cert, enterprise_feature, api_release, customer_story
 *  - case_study, press_release, new_pricing_page, technology_change, hiring_spike
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";

export type SignalType =
  | "product_launch"
  | "pricing_change"
  | "new_feature"
  | "hiring_increase"
  | "funding_announcement"
  | "team_growth"
  | "homepage_redesign"
  | "new_integration"
  | "changelog_update"
  | "docs_growth"
  | "new_blog_post"
  | "security_cert"
  | "enterprise_feature"
  | "api_release"
  | "customer_story"
  | "case_study"
  | "press_release"
  | "new_pricing_page"
  | "technology_change"
  | "hiring_spike";

export interface SignalData {
  companyId: string;
  signalType: SignalType;
  title: string;
  description?: string;
  importance: number; // 0-100
  confidence: number; // 0-100
  source: string;
  evidence?: string;
}

/**
 * Detect signals from enrichment data (called after enrichment completes).
 */
export async function detectEnrichmentSignals(companyId: string): Promise<void> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      name: true, domain: true, description: true, headline: true,
      pricingDetected: true, trialDetected: true, freemiumDetected: true, enterpriseDetected: true,
      pricingModel: true, callToAction: true, lastEnrichedAt: true, enrichmentPages: true,
      companyTechnologies: { include: { technology: { select: { name: true } } } },
      sources: { select: { type: true, firstSeenAt: true } },
      historicalSnapshots: { orderBy: { capturedAt: "desc" }, take: 1, select: { data: true, contentHash: true, capturedAt: true } },
    },
  });

  if (!company) return;

  const signals: SignalData[] = [];

  // 1. New pricing page detected
  if (company.pricingDetected) {
    const hadPricingBefore = company.historicalSnapshots[0]
      ? JSON.parse(company.historicalSnapshots[0].data).pricingDetected ?? false
      : false;
    if (!hadPricingBefore) {
      signals.push({
        companyId, signalType: "new_pricing_page",
        title: `${company.name} added a pricing page`,
        description: `Pricing page detected during enrichment. Model: ${company.pricingModel ?? "unknown"}`,
        importance: 75, confidence: 90, source: "enrichment",
        evidence: "Pricing page URL found during crawl",
      });
    }
  }

  // 2. Enterprise pricing detected
  if (company.enterpriseDetected) {
    signals.push({
      companyId, signalType: "enterprise_feature",
      title: `${company.name} introduced enterprise pricing`,
      description: "Enterprise pricing tier detected — likely scaling up",
      importance: 80, confidence: 85, source: "enrichment",
      evidence: "Enterprise pricing signals found on pricing page",
    });
  }

  // 3. Free trial detected
  if (company.trialDetected) {
    signals.push({
      companyId, signalType: "new_feature",
      title: `${company.name} offers a free trial`,
      description: "Free trial detected — product is ready for evaluation",
      importance: 60, confidence: 80, source: "enrichment",
      evidence: "Trial language found on website",
    });
  }

  // 4. Recently launched (first seen recently)
  const firstSource = company.sources[0];
  if (firstSource) {
    const daysSinceDiscovery = (Date.now() - firstSource.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDiscovery <= 7) {
      signals.push({
        companyId, signalType: "product_launch",
        title: `${company.name} recently launched`,
        description: `Discovered ${Math.round(daysSinceDiscovery)} days ago via ${firstSource.type}`,
        importance: 70, confidence: 75, source: "discovery",
        evidence: `First seen: ${firstSource.firstSeenAt.toISOString()}`,
      });
    }
  }

  // 5. Technology changes (compare against previous snapshot)
  if (company.historicalSnapshots[0]) {
    const prevData = JSON.parse(company.historicalSnapshots[0].data);
    const prevTechs: string[] = prevData.technologies ?? [];
    const currentTechs = company.companyTechnologies.map((ct) => ct.technology.name);
    const newTechs = currentTechs.filter((t) => !prevTechs.includes(t));
    if (newTechs.length > 0) {
      signals.push({
        companyId, signalType: "technology_change",
        title: `${company.name} added new technologies: ${newTechs.join(", ")}`,
        description: `${newTechs.length} new technology/technologies detected`,
        importance: 55, confidence: 85, source: "enrichment_diff",
        evidence: `New: ${newTechs.join(", ")}`,
      });
    }
  }

  // Store all signals
  for (const signal of signals) {
    await storeSignal(signal);
  }

  if (signals.length > 0) {
    logger.info("signals.detected", { companyId, count: signals.length });
  }
}

/**
 * Detect signals from AI analysis (called after AI analysis completes).
 */
export async function detectAISignals(companyId: string): Promise<void> {
  const analysis = await db.aIAnalysis.findFirst({
    where: { companyId, status: "completed" },
    orderBy: { analyzedAt: "desc" },
    select: {
      summaryOneLine: true, productCategory: true, companyStage: true,
      hiringStatus: true, hiringTrend: true, productMaturity: true,
      icpMatchPct: true, qualificationScore: true, overallConfidence: true,
      videoOverall: true, websiteOverall: true, pricingModel: true,
    },
  });

  if (!analysis) return;

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  if (!company) return;

  const signals: SignalData[] = [];

  // 6. Hiring growth detected
  if (analysis.hiringTrend === "Growing") {
    signals.push({
      companyId, signalType: "hiring_increase",
      title: `${company.name} is growing its team`,
      description: `AI detected hiring trend: Growing. Team composition: ${analysis.hiringStatus}`,
      importance: 75, confidence: analysis.overallConfidence ?? 70, source: "ai_analysis",
      evidence: `AI hiring trend: ${analysis.hiringTrend}, status: ${analysis.hiringStatus}`,
    });
  }

  // 7. High ICP match
  if (analysis.icpMatchPct && analysis.icpMatchPct >= 80) {
    signals.push({
      companyId, signalType: "product_launch",
      title: `${company.name} is a strong ICP match (${analysis.icpMatchPct}%)`,
      description: `High ICP match score indicates strong buying potential`,
      importance: 85, confidence: analysis.overallConfidence ?? 75, source: "ai_analysis",
      evidence: `ICP match: ${analysis.icpMatchPct}%, qualification: ${analysis.qualificationScore}`,
    });
  }

  // 8. High qualification score
  if (analysis.qualificationScore && analysis.qualificationScore >= 75) {
    signals.push({
      companyId, signalType: "product_launch",
      title: `${company.name} scored ${analysis.qualificationScore}/100 qualification`,
      description: `High qualification score — strong lead opportunity`,
      importance: 80, confidence: analysis.overallConfidence ?? 75, source: "ai_analysis",
      evidence: `Qualification: ${analysis.qualificationScore}, confidence: ${analysis.overallConfidence}%`,
    });
  }

  // 9. Established product maturity
  if (analysis.productMaturity === "Established" || analysis.productMaturity === "Enterprise") {
    signals.push({
      companyId, signalType: "new_feature",
      title: `${company.name} has an ${analysis.productMaturity.toLowerCase()} product`,
      description: `Product maturity: ${analysis.productMaturity}`,
      importance: 65, confidence: analysis.overallConfidence ?? 70, source: "ai_analysis",
      evidence: `AI product maturity: ${analysis.productMaturity}`,
    });
  }

  for (const signal of signals) {
    await storeSignal(signal);
  }

  if (signals.length > 0) {
    logger.info("signals.aiDetected", { companyId, count: signals.length });
  }
}

/**
 * Detect signals from crawl changes (called when a page changes during re-enrichment).
 */
export async function detectChangeSignals(
  companyId: string,
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown; pageType: string }>
): Promise<void> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) return;

  const signals: SignalData[] = [];

  for (const change of changes) {
    // Pricing change
    if (change.field === "pricingModel" || change.field === "pricingDetected") {
      signals.push({
        companyId, signalType: "pricing_change",
        title: `${company.name} pricing changed`,
        description: `${change.field}: ${change.oldValue ?? "none"} → ${change.newValue ?? "none"}`,
        importance: 85, confidence: 90, source: "crawl_diff",
        evidence: `Field ${change.field} changed on ${change.pageType} page`,
      });
    }

    // Homepage redesign
    if (change.field === "contentHash" && change.pageType === "HOMEPAGE") {
      signals.push({
        companyId, signalType: "homepage_redesign",
        title: `${company.name} redesigned their homepage`,
        description: "Homepage content has changed significantly",
        importance: 70, confidence: 85, source: "crawl_diff",
        evidence: `Homepage content hash changed`,
      });
    }

    // New pages
    if (change.field === "newPage") {
      signals.push({
        companyId, signalType: "new_feature",
        title: `${company.name} added a new ${change.newValue} page`,
        description: `New page detected: ${change.newValue}`,
        importance: 60, confidence: 85, source: "crawl_diff",
        evidence: `New page type: ${change.newValue}`,
      });
    }

    // Technology change
    if (change.field === "technologies") {
      signals.push({
        companyId, signalType: "technology_change",
        title: `${company.name} updated their tech stack`,
        description: `Technologies changed: ${change.oldValue ?? "none"} → ${change.newValue ?? "none"}`,
        importance: 55, confidence: 80, source: "crawl_diff",
        evidence: `Technology list changed`,
      });
    }
  }

  for (const signal of signals) {
    await storeSignal(signal);
  }

  if (signals.length > 0) {
    logger.info("signals.changeDetected", { companyId, count: signals.length });
  }
}

/**
 * Store a signal in the database and create a timeline event.
 */
async function storeSignal(signal: SignalData): Promise<void> {
  // Check if a similar signal already exists (avoid duplicates within 24h)
  const existing = await db.signal.findFirst({
    where: {
      companyId: signal.companyId,
      signalType: signal.signalType,
      detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (existing) return; // Don't duplicate

  const created = await db.signal.create({
    data: {
      companyId: signal.companyId,
      signalType: signal.signalType,
      title: signal.title,
      description: signal.description ?? null,
      importance: signal.importance,
      confidence: signal.confidence,
      source: signal.source,
      evidence: signal.evidence ?? null,
    },
  });

  // Also create a timeline event
  await db.timelineEvent.create({
    data: {
      companyId: signal.companyId,
      eventType: signal.signalType,
      title: signal.title,
      description: signal.description ?? null,
      metadata: JSON.stringify({ signalId: created.id, importance: signal.importance, confidence: signal.confidence }),
    },
  });
}

/**
 * Get signals for a company.
 */
export async function getCompanySignals(companyId: string, limit: number = 50) {
  return db.signal.findMany({
    where: { companyId },
    orderBy: { detectedAt: "desc" },
    take: limit,
  });
}

/**
 * Get all recent signals (for the intelligence feed).
 */
export async function getRecentSignals(limit: number = 50, minImportance: number = 50) {
  return db.signal.findMany({
    where: { importance: { gte: minImportance } },
    orderBy: { detectedAt: "desc" },
    take: limit,
    include: {
      company: { select: { id: true, name: true, domain: true, logoUrl: true, industry: true } },
    },
  });
}

/**
 * Get signal statistics for the dashboard.
 */
export async function getSignalStats(): Promise<{
  totalSignals: number;
  todaySignals: number;
  highPrioritySignals: number;
  byType: Record<string, number>;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, highPriority, all] = await Promise.all([
    db.signal.count(),
    db.signal.count({ where: { detectedAt: { gte: todayStart } } }),
    db.signal.count({ where: { importance: { gte: 75 } } }),
    db.signal.findMany({ select: { signalType: true }, take: 10000 }),
  ]);

  const byType: Record<string, number> = {};
  for (const s of all) {
    byType[s.signalType] = (byType[s.signalType] ?? 0) + 1;
  }

  return {
    totalSignals: total,
    todaySignals: today,
    highPrioritySignals: highPriority,
    byType,
  };
}
