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

import { companyRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
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
