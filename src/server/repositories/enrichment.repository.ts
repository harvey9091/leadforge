/**
 * =============================================================================
 * Enrichment Repository
 * =============================================================================
 *
 * Data access layer for enrichment jobs, technologies, screenshots,
 * content blocks, and website snapshots.
 * =============================================================================
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { DetectedTechnology } from "../technologies/detector";
import type { ExtractedContent } from "../content-extractor";
import type { CrawledPage } from "../firecrawl-client";

// ---------------------------------------------------------------------------
// Enrichment Jobs
// ---------------------------------------------------------------------------

export const enrichmentJobRepository = {
  create(companyId: string, schedule: string = "manual") {
    return db.enrichmentJob.create({
      data: { companyId, status: "QUEUED", schedule },
    });
  },

  findById(id: string) {
    return db.enrichmentJob.findUnique({
      where: { id },
      include: { _count: { select: { logs: true } } },
    });
  },

  findByCompanyId(companyId: string, limit: number = 10) {
    return db.enrichmentJob.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { _count: { select: { logs: true } } },
    });
  },

  findPending(limit: number = 5) {
    return db.enrichmentJob.findMany({
      where: { status: { in: ["QUEUED", "RETRYING"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: { company: { select: { id: true, name: true, domain: true, website: true } } },
    });
  },

  findStale(staleBefore: Date) {
    return db.enrichmentJob.findMany({
      where: {
        status: "RUNNING",
        lastHeartbeat: { lt: staleBefore },
      },
    });
  },

  update(id: string, data: Prisma.EnrichmentJobUpdateInput) {
    return db.enrichmentJob.update({ where: { id }, data });
  },

  setStatus(id: string, status: string, extra?: Prisma.EnrichmentJobUpdateInput) {
    return db.enrichmentJob.update({
      where: { id },
      data: { status: status as never, ...extra },
    });
  },

  countByStatus() {
    return db.enrichmentJob.groupBy({
      by: ["status"],
      _count: true,
    });
  },

  async count() {
    return db.enrichmentJob.count();
  },
};

// ---------------------------------------------------------------------------
// Enrichment Logs
// ---------------------------------------------------------------------------

export const enrichmentLogRepository = {
  create(input: {
    jobId: string;
    level: string;
    page?: string;
    message: string;
    metadata?: Record<string, unknown>;
    durationMs?: number;
  }) {
    return db.enrichmentLog.create({
      data: {
        jobId: input.jobId,
        level: input.level,
        page: input.page ?? null,
        message: input.message,
        metadata: JSON.stringify(input.metadata ?? {}),
        durationMs: input.durationMs ?? null,
      },
    });
  },

  listByJob(jobId: string, limit: number = 100) {
    return db.enrichmentLog.findMany({
      where: { jobId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  },
};

// ---------------------------------------------------------------------------
// Technologies
// ---------------------------------------------------------------------------

export const technologyRepository = {
  async upsert(name: string, slug: string, category: string, description?: string) {
    return db.technology.upsert({
      where: { slug },
      create: { name, slug, category, description },
      update: { name, category, description },
    });
  },

  async attachToCompany(companyId: string, techSlug: string, confidence: number = 100) {
    const tech = await db.technology.findUnique({ where: { slug: techSlug } });
    if (!tech) return;
    await db.companyTechnology.upsert({
      where: { companyId_technologyId: { companyId, technologyId: tech.id } },
      create: { companyId, technologyId: tech.id, confidence },
      update: { confidence },
    });
  },

  async listByCompany(companyId: string) {
    return db.companyTechnology.findMany({
      where: { companyId },
      include: { technology: true },
      orderBy: { technology: { category: "asc" } },
    });
  },

  async replaceCompanyTechnologies(companyId: string, technologies: DetectedTechnology[]) {
    // Delete existing
    await db.companyTechnology.deleteMany({ where: { companyId } });
    // Insert new
    for (const tech of technologies) {
      const techRecord = await this.upsert(tech.name, tech.slug, tech.category);
      await db.companyTechnology.create({
        data: { companyId, technologyId: techRecord.id, confidence: tech.confidence },
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

export const screenshotRepository = {
  create(input: {
    companyId: string;
    pageType: string;
    url: string;
    thumbnailUrl?: string;
    fullUrl?: string;
    width?: number;
    height?: number;
  }) {
    return db.screenshot.create({ data: input });
  },

  listByCompany(companyId: string) {
    return db.screenshot.findMany({
      where: { companyId },
      orderBy: { capturedAt: "desc" },
    });
  },
};

// ---------------------------------------------------------------------------
// Content Blocks
// ---------------------------------------------------------------------------

export const contentBlockRepository = {
  async replaceForCompany(companyId: string, blocks: Array<{
    pageType: string;
    blockType: string;
    heading?: string;
    content: string;
    order: number;
  }>) {
    await db.contentBlock.deleteMany({ where: { companyId } });
    if (blocks.length === 0) return;
    await db.contentBlock.createMany({
      data: blocks.map((b) => ({ ...b, companyId })),
    });
  },

  listByCompany(companyId: string) {
    return db.contentBlock.findMany({
      where: { companyId },
      orderBy: [{ pageType: "asc" }, { order: "asc" }],
    });
  },
};

// ---------------------------------------------------------------------------
// Website Snapshots (for diff engine)
// ---------------------------------------------------------------------------

export const snapshotRepository = {
  create(input: {
    companyId: string;
    url: string;
    pageType: string;
    title?: string;
    description?: string;
    contentHash?: string;
    wordCount?: number;
  }) {
    return db.websiteSnapshot.create({ data: input });
  },

  listByCompany(companyId: string, limit: number = 20) {
    return db.websiteSnapshot.findMany({
      where: { companyId },
      orderBy: { capturedAt: "desc" },
      take: limit,
    });
  },

  /** Get the most recent snapshot for a page type */
  async getLatest(companyId: string, pageType: string) {
    return db.websiteSnapshot.findFirst({
      where: { companyId, pageType },
      orderBy: { capturedAt: "desc" },
    });
  },
};

// ---------------------------------------------------------------------------
// Company enrichment update
// ---------------------------------------------------------------------------

export const companyEnrichmentRepository = {
  async updateEnrichment(companyId: string, content: ExtractedContent, pagesCrawled: number, durationMs: number) {
    const updateData: Prisma.CompanyUpdateInput = {
      headline: content.h1 ?? content.title,
      description: content.description,
      logoUrl: content.logoUrl,
      heroImageUrl: content.heroImageUrl,
      callToAction: content.callToAction,
      pricingDetected: content.pricingDetected,
      trialDetected: content.trialDetected,
      freemiumDetected: content.freemiumDetected,
      enterpriseDetected: content.enterpriseDetected,
      pricingModel: content.pricingModel,
      languages: JSON.stringify(content.languages),
      supportEmail: content.supportEmail,
      contactEmail: content.contactEmail,
      phone: content.phone,
      address: content.address,
      linkedinUrl: content.socialLinks.linkedin,
      twitterUrl: content.socialLinks.twitter,
      lastEnrichedAt: new Date(),
      enrichmentStatus: "completed",
      enrichmentPages: pagesCrawled,
      enrichmentDurationMs: durationMs,
      searchVector: await buildEnrichedSearchVector(companyId, content),
    };

    return db.company.update({ where: { id: companyId }, data: updateData });
  },

  async updateWebsiteHealth(companyId: string, health: {
    https: boolean;
    status: number;
    speedMs: number;
    redirects: boolean;
    robotsTxt?: string;
    sitemapUrl?: string;
    canonicalUrl?: string;
  }) {
    return db.company.update({
      where: { id: companyId },
      data: {
        websiteHttps: health.https,
        websiteStatus: health.status,
        websiteSpeedMs: health.speedMs,
        websiteRedirects: health.redirects,
        robotsTxt: health.robotsTxt,
        sitemapUrl: health.sitemapUrl,
        canonicalUrl: health.canonicalUrl,
      },
    });
  },
};

async function buildEnrichedSearchVector(companyId: string, content: ExtractedContent): Promise<string> {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return "";

  const parts = [
    company.name,
    company.domain ?? "",
    content.title ?? "",
    content.description ?? company.description ?? "",
    content.h1 ?? "",
    content.keywords.join(" "),
    content.callToAction ?? "",
    content.pricingModel ?? "",
  ];

  return parts.join(" ").toLowerCase().trim();
}
