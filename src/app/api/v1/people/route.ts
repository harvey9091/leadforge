/**
 * GET /api/v1/people
 * List people with pagination.
 */

import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10)));
    const q = url.searchParams.get("q")?.trim();
    const verified = url.searchParams.get("verified");

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { fullName: { contains: q } },
        { email: { contains: q } },
        { title: { contains: q } },
      ];
    }
    if (verified === "true") where.verified = true;

    const [data, total] = await Promise.all([
      db.person.findMany({
        where,
        include: { company: { select: { id: true, name: true, domain: true, logoUrl: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.person.count({ where }),
    ]);

    return apiSuccess(
      {
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasMore: page * pageSize < total,
        },
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
