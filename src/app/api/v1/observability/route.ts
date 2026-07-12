/**
 * GET /api/v1/observability — get comprehensive observability snapshot
 */
import { captureObservabilitySnapshot, getMetricHistory } from "@/server/reliability/observability";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const historyMetric = url.searchParams.get("history");
    const historyHours = parseInt(url.searchParams.get("hours") ?? "24", 10);

    if (historyMetric) {
      const history = await getMetricHistory(historyMetric, historyHours);
      return apiSuccess({ metric: historyMetric, data: history }, { requestId: ctx.requestId });
    }

    const snapshot = await captureObservabilitySnapshot();
    return apiSuccess(snapshot, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
