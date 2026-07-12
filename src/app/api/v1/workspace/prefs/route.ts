/**
 * GET /api/v1/workspace/prefs — get workspace preferences
 * PUT /api/v1/workspace/prefs — update workspace preferences
 */
import { workspacePrefsRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const prefs = await workspacePrefsRepository.get();
    return apiSuccess({ prefs }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function PUT(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const current = await workspacePrefsRepository.get();
    const prefs = await workspacePrefsRepository.update(current.id, body);
    return apiSuccess({ prefs }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
