/**
 * GET /api/v1/watchlists/:id — get watchlist with companies
 * DELETE /api/v1/watchlists/:id — delete watchlist
 * POST /api/v1/watchlists/:id — add/remove company
 */
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext, readJson } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const watchlist = await db.watchlist.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            company: { select: { id: true, name: true, domain: true, logoUrl: true, industry: true, country: true } },
          },
          orderBy: { addedAt: "desc" },
        },
      },
    });
    if (!watchlist) return apiError(new Error("Watchlist not found"), ctx.requestId);
    return apiSuccess({ watchlist }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    await db.watchlist.delete({ where: { id } });
    return apiSuccess({ ok: true }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const body = await readJson(req);
    const { companyId, action } = body as { companyId: string; action: "add" | "remove" };

    if (action === "add") {
      await db.watchlistItem.upsert({
        where: { watchlistId_companyId: { watchlistId: id, companyId } },
        create: { watchlistId: id, companyId },
        update: {},
      });
    } else {
      await db.watchlistItem.delete({
        where: { watchlistId_companyId: { watchlistId: id, companyId } },
      }).catch(() => null);
    }
    return apiSuccess({ ok: true, action }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
