/**
 * GET /api/v1/companies/search?q=...&page=1&pageSize=50
 * Advanced search across all company data.
 */

import { executeSearch, recordSearchHistory, autocomplete, parseQuery } from "@/server/workspace/search-engine";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10)));
    const sortBy = url.searchParams.get("sortBy") ?? "relevance";
    const sortDir = (url.searchParams.get("sortDir") ?? "desc") as "asc" | "desc";

    // Autocomplete mode
    const autocompleteMode = url.searchParams.get("autocomplete") === "true";
    if (autocompleteMode) {
      const suggestions = await autocomplete(q, 10);
      return apiSuccess({ suggestions }, { requestId: ctx.requestId });
    }

    const result = await executeSearch({ query: q, page, pageSize, sortBy, sortDir });

    // Record search history (async, don't block)
    if (q.trim()) {
      void recordSearchHistory(q, result.pagination.total);
    }

    return apiSuccess(result, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
