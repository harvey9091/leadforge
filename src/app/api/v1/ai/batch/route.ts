/**
 * POST /api/v1/ai/batch
 * Start batch analysis of all enriched-but-unanalyzed companies.
 * Body: { limit?: number }
 */

import { z } from "zod";
import { aiJobRepository } from "@/server/repositories/ai.repository";
import { ensureAIWorkerStarted } from "@/server/ai/worker/bootstrap";
import { notifyNewAIJob } from "@/server/ai/worker/worker";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const batchSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional().default(100),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  ensureAIWorkerStarted();
  try {
    const body = await readJson(req);
    const input = validate(batchSchema, body);

    // Count companies that need analysis
    const count = await db.company.count({
      where: {
        lastEnrichedAt: { not: null },
        aiAnalyses: { none: { status: "completed" } },
      },
    });

    if (count === 0) {
      return apiSuccess({ job: null, message: "No companies pending analysis" }, { requestId: ctx.requestId });
    }

    const batchId = `batch-${Date.now()}`;
    const job = await aiJobRepository.create(null, batchId, "batch", Math.min(count, input.limit));
    notifyNewAIJob();

    return apiSuccess({
      job,
      pendingCount: count,
      message: `Batch analysis started for ${Math.min(count, input.limit)} companies`,
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
