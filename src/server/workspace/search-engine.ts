/**
 * =============================================================================
 * Advanced Search Engine
 * =============================================================================
 *
 * Full-text search across all company data with support for:
 *  - Fuzzy matching (case-insensitive, partial)
 *  - Quoted phrases ("exact match")
 *  - Boolean operators (AND, OR, NOT)
 *  - Exclusion (-term)
 *  - Field-specific search (industry:AI, country:US)
 *  - Autocomplete
 *  - Search history
 * =============================================================================
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface SearchQuery {
  query: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface SearchResult {
  data: SearchCompany[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  facets: SearchFacets;
}

export interface SearchCompany {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  industry: string | null;
  country: string | null;
  logoUrl: string | null;
  pricingModel: string | null;
  fundingStage: string | null;
  lastEnrichedAt: string | null;
  discoveredAt: string;
  icpMatchPct: number | null;
  qualificationScore: number | null;
  overallConfidence: number | null;
  videoOverall: number | null;
  aiSummary: string | null;
  technologies: string[];
  tags: string[];
  score: number;
}

export interface SearchFacets {
  industries: Array<{ value: string; count: number }>;
  countries: Array<{ value: string; count: number }>;
  pricingModels: Array<{ value: string; count: number }>;
  fundingStages: Array<{ value: string; count: number }>;
  sources: Array<{ value: string; count: number }>;
}

interface ParsedQuery {
  terms: string[];
  phrases: string[];
  exclusions: string[];
  fieldFilters: Array<{ field: string; value: string }>;
  operators: Array<{ type: "AND" | "OR"; term: string }>;
}

/**
 * Parse a search query into structured components.
 */
export function parseQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    terms: [],
    phrases: [],
    exclusions: [],
    fieldFilters: [],
    operators: [],
  };

  // Extract quoted phrases — collect all first, then remove
  let match: RegExpExecArray | null;
  let workingQuery = query;
  const phraseRegex = /"([^"]+)"/g;
  const phraseMatches: string[] = [];
  while ((match = phraseRegex.exec(query)) !== null) {
    phraseMatches.push(match[1]!.toLowerCase());
  }
  for (const phrase of phraseMatches) {
    result.phrases.push(phrase);
    workingQuery = workingQuery.replace(`"${phrase}"`, " ");
  }

  // Extract field-specific filters (field:value) — collect all first, then remove
  const fieldRegex = /(\w+):(\S+)/g;
  const fieldMatches: Array<{ match: string; field: string; value: string }> = [];
  while ((match = fieldRegex.exec(workingQuery)) !== null) {
    fieldMatches.push({ match: match[0], field: match[1]!.toLowerCase(), value: match[2]!.toLowerCase() });
  }
  for (const fm of fieldMatches) {
    result.fieldFilters.push({ field: fm.field, value: fm.value });
    workingQuery = workingQuery.replace(fm.match, " ");
  }

  // Parse remaining tokens
  const tokens = workingQuery.split(/\s+/).filter((t) => t.length > 0);
  let lastOperator: "AND" | "OR" | "NOT" | null = null;

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower === "and") {
      lastOperator = "AND";
      continue;
    }
    if (lower === "or") {
      lastOperator = "OR";
      continue;
    }
    if (lower === "not") {
      // NOT means the next term is an exclusion
      lastOperator = "NOT";
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      result.exclusions.push(token.slice(1).toLowerCase());
      lastOperator = null;
    } else if (lastOperator === "NOT") {
      result.exclusions.push(lower);
      lastOperator = null;
    } else {
      result.terms.push(lower);
      if (lastOperator) {
        result.operators.push({ type: lastOperator, term: lower });
      }
      lastOperator = null;
    }
  }

  return result;
}

/**
 * Execute a search query against the database.
 */
export async function executeSearch(searchQuery: SearchQuery): Promise<SearchResult> {
  const { query, page = 1, pageSize = 50, sortBy = "discoveredAt", sortDir = "desc" } = searchQuery;
  const parsed = parseQuery(query);

  // Build the where clause
  const where: Prisma.CompanyWhereInput = { AND: [] };

  // Build OR conditions for each search term/phrase
  if (parsed.terms.length > 0 || parsed.phrases.length > 0) {
    const orConditions: Prisma.CompanyWhereInput[] = [];

    for (const term of [...parsed.terms, ...parsed.phrases]) {
      orConditions.push({ name: { contains: term } });
      orConditions.push({ domain: { contains: term } });
      orConditions.push({ description: { contains: term } });
      orConditions.push({ industry: { contains: term } });
      orConditions.push({ searchVector: { contains: term } });
      orConditions.push({ country: { contains: term } });
      orConditions.push({ headline: { contains: term } });
      orConditions.push({ callToAction: { contains: term } });
    }

    (where.AND as Prisma.CompanyWhereInput[]).push({ OR: orConditions });
  }

  // Handle exclusions
  for (const excl of parsed.exclusions) {
    (where.AND as Prisma.CompanyWhereInput[]).push({
      NOT: {
        OR: [
          { name: { contains: excl } },
          { domain: { contains: excl } },
          { description: { contains: excl } },
        ],
      },
    });
  }

  // Handle field-specific filters
  for (const filter of parsed.fieldFilters) {
    const fieldMap: Record<string, string> = {
      industry: "industry",
      country: "country",
      domain: "domain",
      name: "name",
      funding: "fundingStage",
      pricing: "pricingModel",
      stage: "companyStage",
    };
    const fieldName = fieldMap[filter.field];
    if (fieldName) {
      (where.AND as Prisma.CompanyWhereInput[]).push({
        [fieldName]: { contains: filter.value },
      });
    }
  }

  // If no search terms at all, return all
  if (parsed.terms.length === 0 && parsed.phrases.length === 0 && parsed.fieldFilters.length === 0 && parsed.exclusions.length === 0) {
    delete where.AND;
  }

  // Build orderBy — "relevance" is handled in-memory, not via Prisma
  const validSortFields = ["discoveredAt", "name", "domain", "industry", "country", "createdAt", "updatedAt", "lastEnrichedAt"];
  const orderBy: Prisma.CompanyOrderByWithRelationInput = validSortFields.includes(sortBy)
    ? { [sortBy]: sortDir }
    : { discoveredAt: sortDir };

  // Execute search
  const [companies, total] = await Promise.all([
    db.company.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tags: { include: { tag: { select: { name: true } } } },
        companyTechnologies: { include: { technology: { select: { name: true } } } },
        aiAnalyses: {
          where: { status: "completed" },
          select: {
            summaryOneLine: true,
            icpMatchPct: true,
            qualificationScore: true,
            overallConfidence: true,
            videoOverall: true,
          },
          take: 1,
          orderBy: { analyzedAt: "desc" },
        },
        sources: { select: { type: true } },
      },
    }),
    db.company.count({ where }),
  ]);

  // Calculate relevance scores
  const allTerms = [...parsed.terms, ...parsed.phrases];
  const results: SearchCompany[] = companies.map((c) => {
    const ai = c.aiAnalyses[0];
    let score = 0;
    const searchText = `${c.name} ${c.domain ?? ""} ${c.description ?? ""} ${c.industry ?? ""}`.toLowerCase();
    for (const term of allTerms) {
      if (c.name?.toLowerCase().includes(term)) score += 10;
      if (c.domain?.toLowerCase().includes(term)) score += 8;
      if (c.description?.toLowerCase().includes(term)) score += 5;
      if (c.industry?.toLowerCase().includes(term)) score += 3;
      if (searchText.includes(term)) score += 1;
    }

    return {
      id: c.id,
      name: c.name,
      domain: c.domain,
      description: c.description,
      industry: c.industry,
      country: c.country,
      logoUrl: c.logoUrl,
      pricingModel: c.pricingModel,
      fundingStage: c.fundingStage,
      lastEnrichedAt: c.lastEnrichedAt?.toISOString() ?? null,
      discoveredAt: c.discoveredAt.toISOString(),
      icpMatchPct: ai?.icpMatchPct ?? null,
      qualificationScore: ai?.qualificationScore ?? null,
      overallConfidence: ai?.overallConfidence ?? null,
      videoOverall: ai?.videoOverall ?? null,
      aiSummary: ai?.summaryOneLine ?? null,
      technologies: c.companyTechnologies.map((ct) => ct.technology.name),
      tags: c.tags.map((t) => t.tag.name),
      score,
    };
  });

  // Sort by relevance if no explicit sort
  if (sortBy === "relevance" && allTerms.length > 0) {
    results.sort((a, b) => b.score - a.score);
  }

  // Build facets
  const facets = await buildFacets(where);

  return {
    data: results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    },
    facets,
  };
}

async function buildFacets(where: Prisma.CompanyWhereInput): Promise<SearchFacets> {
  const [industries, countries, pricingModels, fundingStages] = await Promise.all([
    db.company.groupBy({ by: ["industry"], where: { ...where, industry: { not: null } }, _count: true, take: 20 }),
    db.company.groupBy({ by: ["country"], where: { ...where, country: { not: null } }, _count: true, take: 20 }),
    db.company.groupBy({ by: ["pricingModel"], where: { ...where, pricingModel: { not: null } }, _count: true, take: 20 }),
    db.company.groupBy({ by: ["fundingStage"], where: { ...where, fundingStage: { not: null } }, _count: true, take: 20 }),
  ]);

  return {
    industries: industries.map((i) => ({ value: i.industry!, count: i._count })),
    countries: countries.map((c) => ({ value: c.country!, count: c._count })),
    pricingModels: pricingModels.map((p) => ({ value: p.pricingModel!, count: p._count })),
    fundingStages: fundingStages.map((f) => ({ value: f.fundingStage!, count: f._count })),
    sources: [],
  };
}

/**
 * Autocomplete — suggest search terms based on input.
 */
export async function autocomplete(prefix: string, limit: number = 10): Promise<string[]> {
  if (!prefix || prefix.length < 2) return [];

  const suggestions = new Set<string>();

  // Search company names
  const companies = await db.company.findMany({
    where: { name: { contains: prefix } },
    select: { name: true },
    take: limit,
  });
  for (const c of companies) suggestions.add(c.name);

  // Search domains
  const domains = await db.company.findMany({
    where: { domain: { contains: prefix } },
    select: { domain: true },
    take: limit,
  });
  for (const d of domains) if (d.domain) suggestions.add(d.domain);

  // Search industries
  const industries = await db.company.findMany({
    where: { industry: { contains: prefix } },
    select: { industry: true },
    distinct: ["industry"],
    take: limit,
  });
  for (const i of industries) if (i.industry) suggestions.add(i.industry);

  return Array.from(suggestions).slice(0, limit);
}

/**
 * Record a search in history.
 */
export async function recordSearchHistory(query: string, resultsCount: number): Promise<void> {
  if (!query.trim()) return;
  try {
    await db.searchHistory.create({
      data: { query: query.trim(), resultsCount },
    });
  } catch {
    // ignore — search history is best-effort
  }
}
