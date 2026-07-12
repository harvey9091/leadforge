/**
 * POST /api/v1/auth/refresh
 *
 * Exchange a valid refresh token for a new access + refresh token pair.
 * The old refresh token is revoked (rotation) — detecting reuse triggers
 * a full session invalidation for that user.
 *
 * Body: { refreshToken?: string } — also accepts the httpOnly cookie.
 */

import { authService } from "@/server/services/auth.service";
import { setAuthCookies, clearAuthCookies } from "@/server/utils/cookies";
import { env } from "@/server/config/env";
import { apiError, apiSuccess, getRequestContext, readJson } from "@/server/utils/api";
import { AuthError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    let refreshToken: string | undefined;
    try {
      const body = await readJson<{ refreshToken?: string }>(req);
      refreshToken = body.refreshToken;
    } catch {
      // Body may be empty — fall back to cookie.
    }
    if (!refreshToken) {
      const cookieHeader = req.headers.get("cookie") ?? "";
      refreshToken = parseCookie(cookieHeader, env.cookie.refreshName);
    }
    if (!refreshToken) throw new AuthError("Missing refresh token");

    const result = await authService.refresh({
      refreshToken,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });

    const res = apiSuccess(result, { requestId: ctx.requestId });
    return setAuthCookies(res, result);
  } catch (err) {
    const res = apiError(err, ctx.requestId);
    return clearAuthCookies(res);
  }
}

function parseCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name && v) return decodeURIComponent(v);
  }
  return undefined;
}
