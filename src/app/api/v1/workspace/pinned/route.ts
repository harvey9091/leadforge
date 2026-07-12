/**
 * GET /api/v1/workspace/pinned — list pinned companies
 * POST /api/v1/workspace/pinned — pin a company
 * Body: { companyId: string, action: "pin" | "unpin" }
 */
import { z } from "zod";
import { pinnedCompanyRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const pinSchema = z.object({
  companyId: z.string(),
  action: z.enum(["pin", "unpin"]).default("pin"),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const pinned = await pinnedCompanyRepository.list();
    return apiSuccess({ data: pinned }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(pinSchema, body);
    if (input.action === "pin") {
      await pinnedCompanyRepository.pin(input.companyId);
    } else {
      await pinnedCompanyRepository.unpin(input.companyId);
    }
    return apiSuccess({ ok: true, action: input.action }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
