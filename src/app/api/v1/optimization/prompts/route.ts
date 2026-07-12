/**
 * GET /api/v1/optimization/prompts — get prompt version stats
 * POST /api/v1/optimization/prompts — create new prompt version
 */
import { z } from "zod";
import { getPromptStats, createPromptVersion, startABTest } from "@/server/optimization/prompt-versioning";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const createSchema = z.object({
  version: z.string(),
  systemPrompt: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const abTestSchema = z.object({
  name: z.string(),
  versionAId: z.string(),
  versionBId: z.string(),
  sampleSize: z.number().optional(),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const stats = await getPromptStats();
    return apiSuccess(stats, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    // Check if it's an A/B test request
    if ("versionAId" in body && "versionBId" in body) {
      const input = validate(abTestSchema, body);
      const test = await startABTest(input);
      return apiSuccess({ test }, { requestId: ctx.requestId });
    }
    // Otherwise, create a new prompt version
    const input = validate(createSchema, body);
    const version = await createPromptVersion(input);
    return apiSuccess({ version }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
