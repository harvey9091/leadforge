/**
 * GET /api/v1/optimization/metrics — get system metrics dashboard
 */
import { getMetricsDashboard } from "@/server/optimization/system-metrics";
import { getCrawlStats } from "@/server/optimization/incremental-crawl";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const [dashboard, crawlStats] = await Promise.all([
      getMetricsDashboard(),
      getCrawlStats(),
    ]);
    return apiSuccess({ ...dashboard, crawlStats }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
