/**
 * GET /api/v1/signals — get recent signals (intelligence feed)
 */
import { getRecentSignals, getSignalStats } from "@/server/signals/signal-engine";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const minImportance = parseInt(url.searchParams.get("minImportance") ?? "50", 10);
    const statsOnly = url.searchParams.get("stats") === "true";

    if (statsOnly) {
      const stats = await getSignalStats();
      return apiSuccess(stats, { requestId: ctx.requestId });
    }

    const signals = await getRecentSignals(limit, minImportance);
    return apiSuccess({ data: signals }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
