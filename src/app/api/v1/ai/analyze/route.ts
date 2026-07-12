/**
 * POST /api/v1/ai/analyze
 * Analyze a single company with the AI engine.
 * Body: { companyId: string }
 *
 * GET /api/v1/ai/jobs
 * List AI jobs.
 */

import { z } from "zod";
import { aiJobRepository } from "@/server/repositories/ai.repository";
import { ensureAIWorkerStarted } from "@/server/ai/worker/bootstrap";
import { notifyNewAIJob } from "@/server/ai/worker/worker";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const analyzeSchema = z.object({
  companyId: z.string().min(1),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  ensureAIWorkerStarted();
  try {
    const body = await readJson(req);
    const input = validate(analyzeSchema, body);

    const company = await db.company.findUnique({ where: { id: input.companyId } });
    if (!company) return apiError(new Error("Company not found"), ctx.requestId);

    const job = await aiJobRepository.create(company.id, null, "single", 1);
    notifyNewAIJob();

    return apiSuccess({ job }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  ensureAIWorkerStarted();
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const jobs = await aiJobRepository.list(limit);
    return apiSuccess({ data: jobs }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
