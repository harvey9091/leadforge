/**
 * GET /api/v1/recommendations — get top recommendations
 * POST /api/v1/recommendations — generate recommendations for a company
 */
import { z } from "zod";
import { getTopRecommendations, generateRecommendations } from "@/server/signals/recommendation-engine";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const generateSchema = z.object({ companyId: z.string() });

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));
    const recs = await getTopRecommendations(limit);
    return apiSuccess({ data: recs }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(generateSchema, body);
    const recs = await generateRecommendations(input.companyId);
    return apiSuccess({ data: recs }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
