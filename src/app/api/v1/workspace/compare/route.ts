/**
 * POST /api/v1/workspace/compare
 * Compare up to 5 companies side-by-side.
 * Body: { companyIds: string[] }
 */

import { z } from "zod";
import { comparisonRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const compareSchema = z.object({
  companyIds: z.array(z.string()).min(2).max(5),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(compareSchema, body);
    const companies = await comparisonRepository.compare(input.companyIds);
    return apiSuccess({ companies }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
