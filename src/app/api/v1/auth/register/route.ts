/**
 * POST /api/v1/auth/register
 *
 * Create a new user account. The first user ever created is automatically
 * promoted to ADMIN — this bootstraps the single-tenant Phase 1 deployment.
 *
 * Returns: { user, accessToken, refreshToken, expiresIn }
 * Sets: httpOnly cookies (lf_session, lf_refresh)
 */

import { NextResponse } from "next/server";
import { authService } from "@/server/services/auth.service";
import { registerSchema } from "@/server/utils/schemas";
import { setAuthCookies } from "@/server/utils/cookies";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(registerSchema.omit({ confirmPassword: true }), body);
    const result = await authService.register({
      email: input.email,
      password: input.password,
      name: input.name,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });

    const res = apiSuccess(result, { requestId: ctx.requestId });
    return setAuthCookies(res, result);
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
