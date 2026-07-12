/**
 * POST /api/v1/optimization/feedback — record company feedback
 * GET /api/v1/optimization/feedback — get feedback stats
 */
import { z } from "zod";
import { recordFeedback, getFeedbackStats } from "@/server/optimization/feedback-loop";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  companyId: z.string(),
  rating: z.enum(["excellent", "good", "poor", "false_positive"]),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(feedbackSchema, body);
    await recordFeedback(input.companyId, input.rating, input.notes);
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const stats = await getFeedbackStats();
    return apiSuccess(stats, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
