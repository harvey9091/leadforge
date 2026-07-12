/**
 * GET /api/v1/timeline/:companyId — get company timeline
 */
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const events = await db.timelineEvent.findMany({
      where: { companyId: id },
      orderBy: { timestamp: "desc" },
      take: 100,
    });
    return apiSuccess({ data: events }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
