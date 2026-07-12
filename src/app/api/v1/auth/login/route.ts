/**
 * POST /api/v1/auth/login
 *
 * Authenticate a user with email + password. Issues access + refresh tokens.
 *
 * Returns: { user, accessToken, refreshToken, expiresIn }
 */

import { authService } from "@/server/services/auth.service";
import { loginSchema } from "@/server/utils/schemas";
import { setAuthCookies } from "@/server/utils/cookies";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(loginSchema, body);
    const result = await authService.login({
      email: input.email,
      password: input.password,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });

    const res = apiSuccess(result, { requestId: ctx.requestId });
    return setAuthCookies(res, result);
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
