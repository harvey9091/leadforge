/**
 * GET /api/v1/audit-logs
 * List audit log entries (admin only).
 */

import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10)));

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count(),
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
