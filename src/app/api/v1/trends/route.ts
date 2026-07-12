/**
 * GET /api/v1/trends — get trend analysis
 */
import { calculateTrends } from "@/server/signals/trend-analysis";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const trends = await calculateTrends();
    return apiSuccess(trends, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
