/**
 * PUT /api/v1/workspace/notes/:id — update note
 * DELETE /api/v1/workspace/notes/:id — delete note
 */
import { z } from "zod";
import { noteRepository } from "@/server/repositories/workspace.repository";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const updateSchema = z.object({ content: z.string().min(1) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const body = await readJson(req);
    const input = validate(updateSchema, body);
    const note = await noteRepository.update(id, input.content);
    return apiSuccess({ note }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    await noteRepository.delete(id);
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
