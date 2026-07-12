/**
 * Workspace Repository — collections, notes, saved views, exports, pinned companies
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Collections
export const collectionRepository = {
  create(input: { name: string; description?: string; color?: string; icon?: string; isSmart?: boolean; smartQuery?: string }) {
    return db.collection.create({ data: input });
  },

  findById(id: string) {
    return db.collection.findUnique({
      where: { id },
      include: { _count: { select: { companies: true } } },
    });
  },

  list() {
    return db.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { companies: true } } },
    });
  },

  update(id: string, data: Prisma.CollectionUpdateInput) {
    return db.collection.update({ where: { id }, data });
  },

  delete(id: string) {
    return db.collection.delete({ where: { id } });
  },

  async addCompany(collectionId: string, companyId: string) {
    return db.collectionCompany.upsert({
      where: { collectionId_companyId: { collectionId, companyId } },
      create: { collectionId, companyId },
      update: {},
    });
  },

  async removeCompany(collectionId: string, companyId: string) {
    return db.collectionCompany.delete({
      where: { collectionId_companyId: { collectionId, companyId } },
    });
  },

  async getCompanies(collectionId: string, page: number = 1, pageSize: number = 50) {
    const [data, total] = await Promise.all([
      db.collectionCompany.findMany({
        where: { collectionId },
        include: {
          company: {
            select: {
              id: true, name: true, domain: true, logoUrl: true,
              industry: true, country: true, discoveredAt: true,
            },
          },
        },
        orderBy: { addedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.collectionCompany.count({ where: { collectionId } }),
    ]);
    return {
      data: data.map((d) => d.company),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },
};

// Notes
export const noteRepository = {
  create(input: { companyId: string; authorId?: string; authorName?: string; content: string }) {
    return db.note.create({ data: input });
  },

  findByCompany(companyId: string) {
    return db.note.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
  },

  update(id: string, content: string) {
    return db.note.update({
      where: { id },
      data: { content, version: { increment: 1 } },
    });
  },

  delete(id: string) {
    return db.note.delete({ where: { id } });
  },
};

// Saved Views
export const savedViewRepository = {
  create(input: {
    name: string; type?: string; query?: string; filters?: Record<string, unknown>;
    columns?: string[]; sortBy?: string; sortDir?: string; isPinned?: boolean; isDefault?: boolean;
  }) {
    return db.savedView.create({
      data: {
        name: input.name,
        type: input.type ?? "search",
        query: input.query,
        filters: JSON.stringify(input.filters ?? {}),
        columns: JSON.stringify(input.columns ?? []),
        sortBy: input.sortBy,
        sortDir: input.sortDir ?? "desc",
        isPinned: input.isPinned ?? false,
        isDefault: input.isDefault ?? false,
      },
    });
  },

  findById(id: string) {
    return db.savedView.findUnique({ where: { id } });
  },

  list(type?: string) {
    return db.savedView.findMany({
      where: type ? { type: type as never } : undefined,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
  },

  update(id: string, data: Prisma.SavedViewUpdateInput) {
    return db.savedView.update({ where: { id }, data });
  },

  delete(id: string) {
    return db.savedView.delete({ where: { id } });
  },
};

// Export Profiles
export const exportProfileRepository = {
  create(input: { name: string; format: string; preset?: string; columns?: unknown[]; fieldMapping?: Record<string, unknown>; includeHeaders?: boolean; isPinned?: boolean }) {
    return db.exportProfile.create({
      data: {
        name: input.name,
        format: input.format,
        preset: input.preset,
        columns: JSON.stringify(input.columns ?? []),
        fieldMapping: JSON.stringify(input.fieldMapping ?? {}),
        includeHeaders: input.includeHeaders ?? true,
        isPinned: input.isPinned ?? false,
      },
    });
  },

  findById(id: string) {
    return db.exportProfile.findUnique({ where: { id } });
  },

  list() {
    return db.exportProfile.findMany({
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
  },

  delete(id: string) {
    return db.exportProfile.delete({ where: { id } });
  },
};

// Export History
export const exportHistoryRepository = {
  create(input: { profileId?: string; profileName?: string; format: string; filters?: Record<string, unknown>; totalRows?: number }) {
    return db.exportHistory.create({
      data: {
        profileId: input.profileId,
        profileName: input.profileName,
        format: input.format,
        filters: JSON.stringify(input.filters ?? {}),
        totalRows: input.totalRows ?? 0,
        status: "pending",
      },
    });
  },

  findById(id: string) {
    return db.exportHistory.findUnique({ where: { id } });
  },

  list(limit: number = 50) {
    return db.exportHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  update(id: string, data: Prisma.ExportHistoryUpdateInput) {
    return db.exportHistory.update({ where: { id }, data });
  },
};

// Search History
export const searchHistoryRepository = {
  list(limit: number = 20) {
    return db.searchHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  delete(id: string) {
    return db.searchHistory.delete({ where: { id } });
  },

  clear() {
    return db.searchHistory.deleteMany({});
  },
};

// Pinned Companies
export const pinnedCompanyRepository = {
  async pin(companyId: string) {
    return db.pinnedCompany.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });
  },

  async unpin(companyId: string) {
    return db.pinnedCompany.delete({ where: { companyId } }).catch(() => null);
  },

  async list() {
    const pinned = await db.pinnedCompany.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        company: {
          select: {
            id: true, name: true, domain: true, logoUrl: true,
            industry: true, country: true, discoveredAt: true,
          },
        },
      },
    });
    return pinned.map((p) => ({ ...p.company, pinnedAt: p.pinnedAt }));
  },

  isPinned(companyId: string) {
    return db.pinnedCompany.findUnique({ where: { companyId } });
  },
};

// Workspace Preferences
export const workspacePrefsRepository = {
  async get() {
    let prefs = await db.workspacePrefs.findFirst();
    if (!prefs) {
      prefs = await db.workspacePrefs.create({ data: {} });
    }
    return prefs;
  },

  async update(id: string, data: Prisma.WorkspacePrefsUpdateInput) {
    return db.workspacePrefs.update({ where: { id }, data });
  },
};

// Comparison
export const comparisonRepository = {
  async compare(companyIds: string[]) {
    const companies = await db.company.findMany({
      where: { id: { in: companyIds } },
      include: {
        companyTechnologies: { include: { technology: { select: { name: true, category: true } } } },
        aiAnalyses: {
          where: { status: "completed" },
          take: 1,
          orderBy: { analyzedAt: "desc" },
        },
        sources: { select: { type: true, url: true, firstSeenAt: true } },
      },
    });

    return companies.map((c) => {
      const ai = c.aiAnalyses[0];
      return {
        id: c.id,
        name: c.name,
        domain: c.domain,
        industry: c.industry,
        country: c.country,
        foundedYear: c.foundedYear,
        fundingStage: c.fundingStage,
        employeeEstimate: c.employeeEstimate,
        pricingModel: c.pricingModel,
        pricingDetected: c.pricingDetected,
        trialDetected: c.trialDetected,
        enterpriseDetected: c.enterpriseDetected,
        technologies: c.companyTechnologies.map((ct) => ({ name: ct.technology.name, category: ct.technology.category })),
        ai: ai ? {
          summary: ai.summaryOneLine,
          icpMatchPct: ai.icpMatchPct,
          qualificationScore: ai.qualificationScore,
          overallConfidence: ai.overallConfidence,
          videoOverall: ai.videoOverall,
          websiteOverall: ai.websiteOverall,
          companyStage: ai.companyStage,
          hiringStatus: ai.hiringStatus,
          targetCustomer: ai.targetCustomer,
          productMaturity: ai.productMaturity,
          pricingModel: ai.pricingModel,
        } : null,
        sources: c.sources,
        discoveredAt: c.discoveredAt,
        lastEnrichedAt: c.lastEnrichedAt,
      };
    });
  },
};
