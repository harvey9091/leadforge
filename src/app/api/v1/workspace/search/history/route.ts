/**
 * GET /api/v1/workspace/search/history — list search history
 * DELETE /api/v1/workspace/search/history — clear history
 */
import { searchHistoryRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const history = await searchHistoryRepository.list(20);
    return apiSuccess({ data: history }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function DELETE(req: Request) {
  const ctx = getRequestContext(req);
  try {
    await searchHistoryRepository.clear();
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
