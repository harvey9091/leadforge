/**
 * GET /api/v1/watchlists — list watchlists
 * POST /api/v1/watchlists — create watchlist
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  criteria: z.record(z.unknown()).optional(),
  isAutoUpdating: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const watchlists = await db.watchlist.findMany({
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { items: true } } },
    });
    return apiSuccess({ data: watchlists }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(createSchema, body);
    const watchlist = await db.watchlist.create({
      data: {
        name: input.name,
        description: input.description,
        color: input.color ?? "#6b7280",
        criteria: JSON.stringify(input.criteria ?? {}),
        isAutoUpdating: input.isAutoUpdating ?? true,
        isPinned: input.isPinned ?? false,
      },
    });
    return apiSuccess({ watchlist }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
