/**
 * GET /api/v1/companies/:id/technologies — get technologies for a company
 */
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const technologies = await db.companyTechnology.findMany({
      where: { companyId: id },
      include: { technology: { select: { name: true, category: true } } },
    });
    return apiSuccess({ data: technologies }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
