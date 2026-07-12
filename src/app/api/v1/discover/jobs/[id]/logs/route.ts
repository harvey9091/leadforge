/**
 * GET /api/v1/discover/jobs/:id/logs
 * Get logs for a discovery job.
 *
 * Query params:
 *  - level: filter by log level (DEBUG, INFO, WARN, ERROR)
 *  - limit: max logs to return (default 200)
 */

import { discoveryLogRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const level = url.searchParams.get("level") ?? undefined;
    const limit = Math.min(1000, parseInt(url.searchParams.get("limit") ?? "200", 10));

    const logs = await discoveryLogRepository.listByJob(id, { level, limit });

    return apiSuccess(
      {
        data: logs.map((log) => ({
          id: log.id,
          jobId: log.jobId,
          level: log.level,
          source: log.source,
          message: log.message,
          metadata: safeParseJson(log.metadata),
          createdAt: log.createdAt,
        })),
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

function safeParseJson(s: string | null): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
