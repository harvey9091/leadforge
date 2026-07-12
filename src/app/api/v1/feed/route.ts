/**
 * GET /api/v1/feed — intelligence feed (important events)
 */
import { getRecentSignals } from "@/server/signals/signal-engine";
import { getTopRecommendations } from "@/server/signals/recommendation-engine";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "30", 10));

    const [signals, recommendations] = await Promise.all([
      getRecentSignals(limit, 50),
      getTopRecommendations(limit),
    ]);

    // Merge signals and recommendations into a single feed
    const feed = [
      ...signals.map((s) => ({
        type: "signal" as const,
        id: s.id,
        companyId: s.companyId,
        companyName: (s.company as { name: string }).name,
        companyDomain: (s.company as { domain: string | null }).domain,
        companyLogo: (s.company as { logoUrl: string | null }).logoUrl,
        title: s.title,
        description: s.description,
        importance: s.importance,
        timestamp: s.detectedAt,
        signalType: s.signalType,
      })),
      ...recommendations.map((r) => ({
        type: "recommendation" as const,
        id: r.id,
        companyId: r.companyId,
        companyName: (r.company as { name: string }).name,
        companyDomain: (r.company as { domain: string | null }).domain,
        companyLogo: (r.company as { logoUrl: string | null }).logoUrl,
        title: r.action.replace(/_/g, " "),
        description: r.reason,
        importance: r.priority,
        timestamp: r.createdAt,
        signalType: null,
      })),
    ].sort((a, b) => {
      // Sort by importance then timestamp
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }).slice(0, limit);

    return apiSuccess({ data: feed }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
