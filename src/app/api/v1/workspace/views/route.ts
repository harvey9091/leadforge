/**
 * GET /api/v1/workspace/views — list saved views
 * POST /api/v1/workspace/views — create saved view
 */
import { z } from "zod";
import { savedViewRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  query: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
  sortDir: z.string().optional(),
  isPinned: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? undefined;
    const views = await savedViewRepository.list(type);
    return apiSuccess({ data: views }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(createSchema, body);
    const view = await savedViewRepository.create(input);
    return apiSuccess({ view }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
