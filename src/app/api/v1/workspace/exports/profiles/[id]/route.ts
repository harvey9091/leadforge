/**
 * DELETE /api/v1/workspace/exports/profiles/:id — delete export profile
 */
import { exportProfileRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    await exportProfileRepository.delete(id);
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
