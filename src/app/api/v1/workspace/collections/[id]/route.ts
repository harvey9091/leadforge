/**
 * GET /api/v1/workspace/collections/:id — get collection
 * PUT /api/v1/workspace/collections/:id — update collection
 * DELETE /api/v1/workspace/collections/:id — delete collection
 */
import { collectionRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const collection = await collectionRepository.findById(id);
    if (!collection) return apiError(new Error("Collection not found"), ctx.requestId);
    return apiSuccess({ collection }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const body = await readJson(req);
    const collection = await collectionRepository.update(id, body);
    return apiSuccess({ collection }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    await collectionRepository.delete(id);
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
