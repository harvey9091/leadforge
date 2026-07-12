/**
 * GET /api/v1/workspace/exports/profiles — list export profiles
 * POST /api/v1/workspace/exports/profiles — create export profile
 */
import { z } from "zod";
import { exportProfileRepository } from "@/server/repositories/workspace.repository";
import { getAvailablePresets } from "@/server/workspace/export/export-engine";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1),
  format: z.enum(["csv", "json", "xlsx"]),
  preset: z.string().optional(),
  columns: z.array(z.object({ field: z.string(), label: z.string() })).optional(),
  fieldMapping: z.record(z.unknown()).optional(),
  includeHeaders: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const [profiles, presets] = await Promise.all([
      exportProfileRepository.list(),
      Promise.resolve(getAvailablePresets()),
    ]);
    return apiSuccess({ data: profiles, presets }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(createSchema, body);
    const profile = await exportProfileRepository.create(input);
    return apiSuccess({ profile }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
