/**
 * GET /api/v1/workspace/collections/:id/companies — list companies in collection
 * POST /api/v1/workspace/collections/:id/companies — add company to collection
 * Body: { companyId: string, action?: "add" | "remove" }
 */
import { z } from "zod";
import { collectionRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const actionSchema = z.object({
  companyId: z.string(),
  action: z.enum(["add", "remove"]).default("add"),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "50", 10);
    const result = await collectionRepository.getCompanies(id, page, pageSize);
    return apiSuccess(result, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const body = await readJson(req);
    const input = validate(actionSchema, body);
    if (input.action === "add") {
      await collectionRepository.addCompany(id, input.companyId);
    } else {
      await collectionRepository.removeCompany(id, input.companyId);
    }
    return apiSuccess({ ok: true, action: input.action }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
