/**
 * POST /api/v1/semantic-search — semantic search
 * Body: { query: string, limit?: number }
 */
import { z } from "zod";
import { semanticSearch } from "@/server/signals/semantic-search";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(searchSchema, body);
    const result = await semanticSearch(input.query, input.limit);
    return apiSuccess(result, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
