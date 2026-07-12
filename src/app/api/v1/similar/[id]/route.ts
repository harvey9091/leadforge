/**
 * GET /api/v1/similar/:companyId — get similar companies
 */
import { findSimilarCompanies, getCachedSimilarCompanies } from "@/server/signals/similar-company-engine";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "true";
    const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10));

    if (refresh) {
      const results = await findSimilarCompanies(id, limit);
      return apiSuccess({ data: results, cached: false }, { requestId: ctx.requestId });
    }

    const cached = await getCachedSimilarCompanies(id, limit);
    if (cached.length > 0) {
      return apiSuccess({ data: cached, cached: true }, { requestId: ctx.requestId });
    }

    // No cache — compute fresh
    const results = await findSimilarCompanies(id, limit);
    return apiSuccess({ data: results, cached: false }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
