/**
 * GET /api/v1/alerts/events — list alert events
 * POST /api/v1/alerts/events/:id/acknowledge — acknowledge alert
 */
import { db } from "@/lib/db";
import { acknowledgeAlert, getAlertStats } from "@/server/reliability/alert-system";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const statsOnly = url.searchParams.get("stats") === "true";
    if (statsOnly) {
      const stats = await getAlertStats();
      return apiSuccess(stats, { requestId: ctx.requestId });
    }
    const events = await db.alertEvent.findMany({
      orderBy: { triggeredAt: "desc" },
      take: 50,
    });
    return apiSuccess({ data: events }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
