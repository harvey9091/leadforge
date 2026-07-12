/**
 * GET /api/v1/auth/me
 *
 * Returns the currently authenticated user's profile. Used by the client
 * on app boot to hydrate the session.
 */

import { authService } from "@/server/services/auth.service";
import { env } from "@/server/config/env";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { AuthError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const [scheme, token] = authHeader.split(" ");
    const accessFromCookie = getCookie(req, env.cookie.name);
    const accessToken =
      scheme === "Bearer" && token ? token : accessFromCookie;
    if (!accessToken) throw new AuthError("Not authenticated");

    const user = authService.verifyAccessToken(accessToken);
    return apiSuccess({ user }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name && v) return decodeURIComponent(v);
  }
  return undefined;
}
