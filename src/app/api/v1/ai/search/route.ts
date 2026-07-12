/**
 * GET /api/v1/ai/search?q=...
 * Search AI analyses by summary, reasons, technologies, industry.
 */

import { aiAnalysisRepository } from "@/server/repositories/ai.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

    if (!q) {
      return apiSuccess({ data: [] }, { requestId: ctx.requestId });
    }

    const results = await aiAnalysisRepository.search(q, limit);
    return apiSuccess({
      data: results.map((a) => ({
        companyId: a.companyId,
        companyName: (a.company as { name: string }).name,
        companyDomain: (a.company as { domain: string | null }).domain,
        summaryOneLine: a.summaryOneLine,
        industry: a.industry,
        productCategory: a.productCategory,
        icpMatch: a.icpMatchPct,
        qualification: a.qualificationScore,
        analyzedAt: a.analyzedAt,
      })),
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
