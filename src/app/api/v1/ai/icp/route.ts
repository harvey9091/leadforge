/**
 * GET /api/v1/ai/icp
 * Get active ICP config.
 *
 * PUT /api/v1/ai/icp
 * Update ICP config.
 */

import { icpRepository } from "@/server/repositories/ai.repository";
import { apiError, apiSuccess, getRequestContext, readJson } from "@/server/utils/api";
import { z } from "zod";

export const runtime = "nodejs";

const icpSchema = z.object({
  name: z.string().optional(),
  industries: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  targetMarkets: z.array(z.string()).optional(),
  minEmployees: z.number().int().nullable().optional(),
  maxEmployees: z.number().int().nullable().optional(),
  fundingStages: z.array(z.string()).optional(),
  hiringRoles: z.array(z.string()).optional(),
  pricingVisible: z.boolean().optional(),
  regions: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const icp = await icpRepository.getActive();
    return apiSuccess({ icp: icpRepository.deserialize(icp) }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

export async function PUT(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = icpSchema.parse(body);

    const icp = await icpRepository.getActive();
    const updated = await icpRepository.update(icp.id, input);

    return apiSuccess({ icp: icpRepository.deserialize(updated) }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
