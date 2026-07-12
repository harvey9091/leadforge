/**
 * GET /api/v1/dead-letter — list dead letter jobs
 * DELETE /api/v1/dead-letter/:id — remove dead letter job
 */
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const jobs = await db.deadLetterJob.findMany({
      orderBy: { deadLetteredAt: "desc" },
      take: 50,
    });
    return apiSuccess({ data: jobs }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function DELETE(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      await db.deadLetterJob.delete({ where: { id } });
    } else {
      await db.deadLetterJob.deleteMany({});
    }
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
