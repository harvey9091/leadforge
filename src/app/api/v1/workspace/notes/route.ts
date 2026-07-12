/**
 * GET /api/v1/workspace/notes?companyId=... — list notes for a company
 * POST /api/v1/workspace/notes — create a note
 */
import { z } from "zod";
import { noteRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const createSchema = z.object({
  companyId: z.string(),
  content: z.string().min(1),
  authorName: z.string().optional(),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");
    if (!companyId) return apiError(new Error("companyId required"), ctx.requestId);
    const notes = await noteRepository.findByCompany(companyId);
    return apiSuccess({ data: notes }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(createSchema, body);
    const note = await noteRepository.create(input);
    return apiSuccess({ note }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
