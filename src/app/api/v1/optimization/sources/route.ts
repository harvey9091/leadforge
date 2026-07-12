/**
 * GET /api/v1/optimization/sources — get source metrics (quality, priority, ranking)
 */
import { getAllSourceMetrics, calculateCompositeScore, recalculatePriorities } from "@/server/optimization/source-metrics";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  const metrics = await getAllSourceMetrics();
  const ranked = metrics.map((m, i) => ({
    ...m,
    rank: i + 1,
    compositeScore: calculateCompositeScore(m),
    duplicateRate: m.companiesDiscovered > 0 ? (m.duplicateCount / m.companiesDiscovered) * 100 : 0,
    retentionRate: m.companiesDiscovered > 0 ? (m.companiesRetained / m.companiesDiscovered) * 100 : 0,
    enrichmentSuccessRate: (m.enrichmentSuccess + m.enrichmentFailure) > 0
      ? (m.enrichmentSuccess / (m.enrichmentSuccess + m.enrichmentFailure)) * 100
      : 0,
  }));
  return apiSuccess({ data: ranked }, { requestId: ctx.requestId });
}

/**
 * POST /api/v1/optimization/sources — recalculate priorities
 */
export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  await recalculatePriorities();
  return apiSuccess({ ok: true, message: "Priorities recalculated" }, { requestId: ctx.requestId });
}
