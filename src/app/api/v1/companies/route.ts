/**
 * GET /api/v1/companies
 *
 * List companies with full-text search, filtering, and sorting.
 * Backed by PostgreSQL (production) / SQLite (dev).
 *
 * Query params:
 *  - page, pageSize
 *  - q (search across name, domain, description, tags)
 *  - source (filter by source type)
 *  - country, industry
 *  - sort (field:asc|desc)
 */

/**
 * POST /api/v1/companies
 *
 * Create a new company manually.
 * Validates required fields, checks for duplicates, creates company and source record.
 */

import { companyRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";
import { extractDomain, extractApexDomain } from "@/server/discovery/normalizer";
import { z } from "zod";
import type { SourceType } from "@prisma/client";

export const runtime = "nodejs";

const MANUAL_SOURCES: SourceType[] = [
  "HACKER_NEWS",
  "PRODUCT_HUNT",
  "YC",
  "BETALIST",
  "DEVHUNT",
  "UNEED",
  "MANUAL",
];

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  website: z.string().url("Invalid URL format").optional().or(z.literal("")),
  industry: z.string().max(100).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  source: z.enum(["Hacker News", "Product Hunt", "Y Combinator", "BetaList", "DevHunt", "Uneed", "Manual"]),
  tags: z.string().optional().or(z.literal("")),
});

function mapSourceLabelToType(label: string): SourceType {
  const map: Record<string, SourceType> = {
    "Hacker News": "HACKER_NEWS",
    "Product Hunt": "PRODUCT_HUNT",
    "Y Combinator": "YC",
    "BetaList": "BETALIST",
    "DevHunt": "DEVHUNT",
    "Uneed": "UNEED",
    "Manual": "MANUAL",
  };
  return map[label] ?? "MANUAL";
}

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q")?.trim() || "") as string;
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));
    const source = url.searchParams.get("source") ?? undefined;
    const country = url.searchParams.get("country") ?? undefined;
    const industry = url.searchParams.get("industry") ?? undefined;
    const sort = url.searchParams.get("sort") ?? "discoveredAt:desc";

    const result = await companyRepository.search(q, {
      page,
      pageSize,
      source,
      country,
      industry,
      sort,
    });

    return apiSuccess(result, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const rawBody = await readJson<unknown>(req);
    const body = validate(createCompanySchema, rawBody);

    const name = body.name.trim();
    const websiteRaw = typeof body.website === "string" ? body.website.trim() : undefined;
    const domain = websiteRaw ? extractDomain(websiteRaw!) : undefined;
    const apexDomain = domain ? extractApexDomain(domain) : undefined;

    const dedupDomains = [apexDomain, domain].filter((d): d is string => !!d);
    const dedupNames = [name];
    const existing = await companyRepository.findForDedup(dedupDomains, dedupNames);

    if (existing.length > 0) {
      const match = existing[0];
      return apiError(
        new Error(
          `A company with a similar name or domain already exists: "${match.name}"`
        ),
        ctx.requestId
      );
    }

    const tags = body.tags
      ? body.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
      : [];

    const sourceType = mapSourceLabelToType(body.source);

    const companyId = await companyRepository.create({
      name,
      website: websiteRaw,
      domain,
      apexDomain,
      description: body.description || undefined,
      industry: body.industry || undefined,
      country: body.country || undefined,
      tags,
      source: sourceType,
      sourceExternalId: `manual-${Date.now()}`,
      raw: { manual: true, sourceLabel: body.source },
      publishedAt: new Date().toISOString(),
    });

    await companyRepository.addSource(companyId, {
      type: sourceType,
      rawPayload: { manual: true, sourceLabel: body.source },
    });

    const created = await companyRepository.findById(companyId);
    if (!created) {
      return apiError(new Error("Failed to retrieve created company"), ctx.requestId);
    }

    return apiSuccess(
      {
        id: created.id,
        name: created.name,
        domain: created.domain,
        status: created.status,
        createdAt: created.createdAt,
      },
      { status: 201, requestId: ctx.requestId }
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("already exists")) {
      return apiError(err, ctx.requestId);
    }
    return apiError(err, ctx.requestId);
  }
}
