/**
 * Auth cookie helpers — set httpOnly cookies carrying access + refresh
 * tokens. The frontend reads the access token from the response body for
 * immediate use, but the cookie is what keeps the session alive across
 * page reloads.
 */

import { NextResponse } from "next/server";
import { env } from "@/server/config/env";

export function setAuthCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string }
) {
  res.cookies.set(env.cookie.name, tokens.accessToken, {
    httpOnly: env.cookie.httpOnly,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    path: env.cookie.path,
    maxAge: env.jwt.expiresIn,
  });
  res.cookies.set(env.cookie.refreshName, tokens.refreshToken, {
    httpOnly: env.cookie.httpOnly,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    path: env.cookie.path,
    maxAge: env.jwt.refreshExpiresIn,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(env.cookie.name, "", { path: env.cookie.path, maxAge: 0 });
  res.cookies.set(env.cookie.refreshName, "", { path: env.cookie.path, maxAge: 0 });
  return res;
}
