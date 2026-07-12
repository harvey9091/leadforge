/**
 * GET /api/v1/workspace/exports/history — list export history
 */
import { exportHistoryRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const history = await exportHistoryRepository.list(limit);
    return apiSuccess({ data: history }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
