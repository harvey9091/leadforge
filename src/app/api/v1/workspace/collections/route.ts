/**
 * GET /api/v1/workspace/collections — list collections
 * POST /api/v1/workspace/collections — create collection
 */
import { z } from "zod";
import { collectionRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isSmart: z.boolean().optional(),
  smartQuery: z.string().optional(),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const collections = await collectionRepository.list();
    return apiSuccess({ data: collections }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(createSchema, body);
    const collection = await collectionRepository.create(input);
    return apiSuccess({ collection }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
