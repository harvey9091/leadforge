/**
 * POST /api/v1/auth/logout
 *
 * Revoke the current refresh token and clear auth cookies.
 */

import { authService } from "@/server/services/auth.service";
import { env } from "@/server/config/env";
import { clearAuthCookies } from "@/server/utils/cookies";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const refreshToken = parseCookie(cookieHeader, env.cookie.refreshName);
    if (refreshToken) await authService.logout(refreshToken);

    const res = apiSuccess({ ok: true }, { requestId: ctx.requestId });
    return clearAuthCookies(res);
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

function parseCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name && v) return decodeURIComponent(v);
  }
  return undefined;
}
