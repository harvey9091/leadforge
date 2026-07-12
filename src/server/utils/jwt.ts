/**
 * JWT utilities — sign/verify access tokens.
 *
 * Access tokens are short-lived (15min) and stateless — the API can verify
 * them without a DB lookup. Refresh tokens (in `/server/utils/crypto.ts`)
 * are opaque strings stored hashed in the DB and rotated on every use.
 *
 * Implementation uses Node's built-in crypto (HMAC-SHA256) — no `jsonwebtoken`
 * dependency, so it works identically in Bun and Node runtimes.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/config/env";
import { AuthError } from "@/server/utils/errors";

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function sign(data: string): string {
  return createHmac("sha256", env.jwt.secret).update(data).digest("base64url");
}

export function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp" | "iss" | "aud" | "type"> & {
    type?: "access" | "refresh";
  }
): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl =
    (payload.type === "refresh"
      ? env.jwt.refreshExpiresIn
      : env.jwt.expiresIn);
  const fullPayload: JwtPayload = {
    ...payload,
    type: payload.type ?? "access",
    iat: now,
    exp: now + ttl,
    iss: env.jwt.issuer,
    aud: env.jwt.audience,
  };
  const header = b64urlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  );
  const body = b64urlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("Malformed token");
  const [header, body, signature] = parts as [string, string, string];

  const expected = sign(`${header}.${body}`);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expBuf.length ||
    !timingSafeEqual(sigBuf, expBuf)
  ) {
    throw new AuthError("Invalid token signature");
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    throw new AuthError("Malformed token payload");
  }

  if (payload.iss !== env.jwt.issuer) throw new AuthError("Invalid issuer");
  if (payload.aud !== env.jwt.audience) throw new AuthError("Invalid audience");
  if (payload.exp * 1000 < Date.now()) throw new AuthError("Token expired");

  return payload;
}
