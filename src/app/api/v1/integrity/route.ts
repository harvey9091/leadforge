/**
 * GET /api/v1/integrity — get integrity check history
 * POST /api/v1/integrity — run integrity checks
 * Body: { repair?: boolean }
 */
import { z } from "zod";
import { runAllChecks, getIntegrityHistory } from "@/server/reliability/data-integrity";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const runSchema = z.object({ repair: z.boolean().default(false) });

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const history = await getIntegrityHistory(20);
    return apiSuccess({ data: history }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(runSchema, body);
    const result = await runAllChecks(input.repair);
    return apiSuccess(result, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
