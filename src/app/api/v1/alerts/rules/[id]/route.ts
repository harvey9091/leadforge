/**
 * PUT /api/v1/alerts/rules/:id — update rule
 * DELETE /api/v1/alerts/rules/:id — delete rule
 */
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext, readJson } from "@/server/utils/api";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const body = await readJson(req);
    const rule = await db.alertRule.update({ where: { id }, data: body });
    return apiSuccess({ rule }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    await db.alertRule.delete({ where: { id } });
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
