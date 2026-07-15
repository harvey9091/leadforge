/**
 * =============================================================================
 * Discovery Repository
 * =============================================================================
 *
 * Data access layer for discovery jobs, logs, and company persistence.
 * All database operations for the discovery engine go through here.
 * =============================================================================
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { buildSearchVector, normalizeName } from "../discovery/normalizer";
import type { NormalizedCompany } from "../discovery/types";
import type { ExistingCompany } from "../discovery/dedup";

// ---------------------------------------------------------------------------
// Discovery Jobs
// ---------------------------------------------------------------------------

export interface CreateDiscoveryJobInput {
  name: string;
  sources: string[];
  maxCompanies: number;
  keywords: string[];
  categories: string[];
  regions: string[];
  fundingStages: string[];
  hiringOnly: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  createdBy?: string;
}

export const discoveryJobRepository = {
  create(input: CreateDiscoveryJobInput) {
    return db.discoveryJob.create({
      data: {
        name: input.name,
        sources: JSON.stringify(input.sources),
        maxCompanies: input.maxCompanies,
        keywords: JSON.stringify(input.keywords),
        categories: JSON.stringify(input.categories),
        regions: JSON.stringify(input.regions),
        fundingStages: JSON.stringify(input.fundingStages),
        hiringOnly: input.hiringOnly,
        dateFrom: input.dateFrom ?? null,
        dateTo: input.dateTo ?? null,
        createdBy: input.createdBy ?? null,
        status: "QUEUED",
      },
    });
  },

  findById(id: string) {
    return db.discoveryJob.findUnique({
      where: { id },
      include: {
        _count: { select: { logs: true, jobSources: true } },
      },
    });
  },

  list(opts: { limit?: number; offset?: number; status?: string } = {}) {
    return db.discoveryJob.findMany({
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
      where: opts.status ? { status: opts.status as never } : undefined,
      include: {
        _count: { select: { logs: true, jobSources: true } },
      },
    });
  },

  update(id: string, data: Prisma.DiscoveryJobUpdateInput) {
    return db.discoveryJob.update({ where: { id }, data });
  },

  updateProgress(id: string, progress: Partial<{
    companiesFound: number;
    companiesStored: number;
    duplicatesFound: number;
    errorsCount: number;
    retriesCount: number;
    currentSource: string;
    currentPage: number;
    totalPages: number;
    lastHeartbeat: Date;
    estimatedCompletion: Date;
  }>) {
    return db.discoveryJob.update({
      where: { id },
      data: progress,
    });
  },

  setStatus(id: string, status: string, extra?: Prisma.DiscoveryJobUpdateInput) {
    return db.discoveryJob.update({
      where: { id },
      data: { status: status as never, ...extra },
    });
  },

  delete(id: string) {
    return db.discoveryJob.delete({ where: { id } });
  },

  /** Find jobs that need to be processed (QUEUED or RETRYING). */
  findPending() {
    return db.discoveryJob.findMany({
      where: { status: { in: ["QUEUED", "RETRYING"] } },
      orderBy: { createdAt: "asc" },
    });
  },

  /** Find jobs that were RUNNING but the worker died (stale heartbeat). */
  findStale(staleAfter: Date) {
    return db.discoveryJob.findMany({
      where: {
        status: "RUNNING",
        lastHeartbeat: { lt: staleAfter },
      },
    });
  },

  count(opts: { status?: string } = {}) {
    return db.discoveryJob.count({
      where: opts.status ? { status: opts.status as never } : undefined,
    });
  },
};

// ---------------------------------------------------------------------------
// Discovery Logs
// ---------------------------------------------------------------------------

export const discoveryLogRepository = {
  create(input: {
    jobId: string;
    level: "DEBUG" | "INFO" | "WARN" | "ERROR";
    source?: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    return db.discoveryLog.create({
      data: {
        jobId: input.jobId,
        level: input.level,
        source: input.source ?? null,
        message: input.message,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });
  },

  listByJob(jobId: string, opts: { limit?: number; level?: string } = {}) {
    return db.discoveryLog.findMany({
      where: {
        jobId,
        ...(opts.level ? { level: opts.level as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 200,
    });
  },

  /** Delete old logs for a job (cleanup). */
  deleteOld(jobId: string, before: Date) {
    return db.discoveryLog.deleteMany({
      where: { jobId, createdAt: { lt: before } },
    });
  },
};

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export const companyRepository = {
  /**
   * Find existing companies matching the given domains or names for dedup.
   * Returns minimal fields needed for dedup.
   */
  async findForDedup(domains: string[], names: string[]): Promise<ExistingCompany[]> {
    if (domains.length === 0 && names.length === 0) return [];

    const where: Prisma.CompanyWhereInput = { OR: [] };
    if (domains.length > 0) {
      where.OR!.push({ domain: { in: domains } });
      where.OR!.push({ apexDomain: { in: domains } });
    }
    if (names.length > 0) {
      where.OR!.push({ name: { in: names } });
    }

    const companies = await db.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        domain: true,
        apexDomain: true,
      },
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      nameNormalized: normalizeName(c.name),
      domain: c.domain,
      apexDomain: c.apexDomain,
    }));
  },

  /** Find a single company by apex domain (for dedup). */
  async findByApexDomain(apexDomain: string): Promise<ExistingCompany | null> {
    const company = await db.company.findFirst({
      where: { apexDomain },
      select: { id: true, name: true, domain: true, apexDomain: true },
    });
    if (!company) return null;
    return {
      id: company.id,
      name: company.name,
      nameNormalized: normalizeName(company.name),
      domain: company.domain,
      apexDomain: company.apexDomain,
    };
  },

  /** Create a new company from normalized data. */
  async create(company: NormalizedCompany): Promise<string> {
    const searchVector = buildSearchVector({
      name: company.name,
      domain: company.domain,
      description: company.description,
      tags: company.tags,
    });

    const created = await db.company.create({
      data: {
        name: company.name,
        website: company.website,
        domain: company.domain,
        apexDomain: company.apexDomain,
        description: company.description,
        logoUrl: company.logoUrl,
        industry: company.industry,
        country: company.country,
        headquarters: company.headquarters,
        foundedYear: company.foundedYear,
        fundingStage: company.fundingStage,
        employeeEstimate: company.employeeEstimate,
        technologies: "[]",
        searchVector,
        status: "NEW",
        discoveredAt: company.publishedAt ? new Date(company.publishedAt) : new Date(),
      },
    });

    // Attach tags
    if (company.tags.length > 0) {
      await this.attachTags(created.id, company.tags);
    }

    return created.id;
  },

  /** Attach tags to a company (creates tags if they don't exist). */
  async attachTags(companyId: string, tags: string[]) {
    for (const tagName of tags) {
      const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) continue;

      const tag = await db.tag.upsert({
        where: { slug },
        create: { name: tagName, slug },
        update: {},
      });

      await db.companyTag.upsert({
        where: { companyId_tagId: { companyId, tagId: tag.id } },
        create: { companyId, tagId: tag.id },
        update: {},
      });
    }
  },

  /** Update an existing company (merge new data without overwriting existing). */
  async mergeUpdate(companyId: string, company: NormalizedCompany) {
    const existing = await db.company.findUnique({ where: { id: companyId } });
    if (!existing) return;

    // Only fill in fields that are missing on the existing record
    const updates: Prisma.CompanyUpdateInput = {};
    if (!existing.description && company.description) updates.description = company.description;
    if (!existing.logoUrl && company.logoUrl) updates.logoUrl = company.logoUrl;
    if (!existing.industry && company.industry) updates.industry = company.industry;
    if (!existing.country && company.country) updates.country = company.country;
    if (!existing.headquarters && company.headquarters) updates.headquarters = company.headquarters;
    if (!existing.foundedYear && company.foundedYear) updates.foundedYear = company.foundedYear;
    if (!existing.fundingStage && company.fundingStage) updates.fundingStage = company.fundingStage;
    if (!existing.employeeEstimate && company.employeeEstimate) updates.employeeEstimate = company.employeeEstimate;
    if (!existing.website && company.website) updates.website = company.website;

    // Rebuild search vector with merged data
    const mergedTags = company.tags.length > 0 ? company.tags : [];
    const searchVector = buildSearchVector({
      name: existing.name,
      domain: existing.domain ?? company.domain,
      description: updates.description ?? existing.description,
      tags: mergedTags,
    });
    updates.searchVector = searchVector;

    await db.company.update({ where: { id: companyId }, data: updates });

    // Attach any new tags
    if (company.tags.length > 0) {
      await this.attachTags(companyId, company.tags);
    }
  },

  /** Create a source record linking a company to its discovery source. */
  async addSource(companyId: string, source: {
    type: string;
    externalId?: string;
    url?: string;
    rawPayload: unknown;
    discoveryJobId?: string;
    confidence?: number;
  }) {
    // Check if this source already exists for this company
    const existing = await db.source.findFirst({
      where: {
        companyId,
        type: source.type as never,
        ...(source.externalId ? { externalId: source.externalId } : {}),
      },
    });

    if (existing) {
      // Update lastSeenAt
      await db.source.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
      return existing.id;
    }

    const created = await db.source.create({
      data: {
        companyId,
        type: source.type as never,
        externalId: source.externalId ?? null,
        url: source.url ?? null,
        rawPayload: JSON.stringify(source.rawPayload),
        discoveryJobId: source.discoveryJobId ?? null,
        confidence: source.confidence ?? 50,
      },
    });
    return created.id;
  },

  /** Full-text search across companies. */
  async search(query: string, opts: {
    page?: number;
    pageSize?: number;
    source?: string;
    country?: string;
    industry?: string;
    sort?: string;
  } = {}) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CompanyWhereInput = {};
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { domain: { contains: query } },
        { description: { contains: query } },
        { searchVector: { contains: query.toLowerCase() } },
        { industry: { contains: query } },
      ];
    }
    if (opts.source) {
      where.sources = { some: { type: opts.source as never } };
    }
    if (opts.country) {
      where.country = { contains: opts.country };
    }
    if (opts.industry) {
      where.industry = { contains: opts.industry };
    }

    let orderBy: Prisma.CompanyOrderByWithRelationInput = { discoveredAt: "desc" };
    if (opts.sort) {
      const [field, dir] = opts.sort.split(":");
      if (field && (dir === "asc" || dir === "desc")) {
        orderBy = { [field]: dir };
      }
    }

    const [data, total] = await Promise.all([
      db.company.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          sources: { select: { type: true, url: true } },
          tags: { include: { tag: { select: { name: true, slug: true } } } },
        },
      }),
      db.company.count({ where }),
    ]);

    return {
      data: data.map(deserializeCompany),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      },
    };
  },

  findById(id: string) {
    return db.company.findUnique({
      where: { id },
      include: {
        sources: true,
        tags: { include: { tag: true } },
        websites: true,
      },
    });
  },

  count() {
    return db.company.count();
  },

  /** Get distinct values for filters. */
  async getFilterOptions() {
    const [countries, industries, sources] = await Promise.all([
      db.company.findMany({
        where: { country: { not: null } },
        select: { country: true },
        distinct: ["country"],
      }),
      db.company.findMany({
        where: { industry: { not: null } },
        select: { industry: true },
        distinct: ["industry"],
      }),
      db.source.findMany({
        select: { type: true },
        distinct: ["type"],
      }),
    ]);

    return {
      countries: countries.map((c) => c.country).filter(Boolean).sort(),
      industries: industries.map((i) => i.industry).filter(Boolean).sort(),
      sources: sources.map((s) => s.type),
    };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deserialize JSON string fields back to objects. */
function deserializeCompany(c: Record<string, unknown>) {
  return {
    ...c,
    technologies: safeJsonArray(c.technologies as string),
    sources: c.sources as unknown[],
    tags: (c.tags as Array<{ tag: { name: string; slug: string } }>)?.map((t) => t.tag.name) ?? [],
  };
}

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
