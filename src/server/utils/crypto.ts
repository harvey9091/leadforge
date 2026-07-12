/**
 * Password hashing — PBKDF2 via Node's built-in crypto.
 *
 * Why PBKDF2 instead of bcrypt/argon2?
 *  - Zero native dependencies (the dev environment uses Bun + Next.js;
 *    native modules require rebuilds per runtime).
 *  - OWASP-approved (600k iterations, SHA-256, 32-byte salt).
 *  - Portable to the Phase 2 Fastify service without changes.
 *
 * The format is `pbkdf2$iterations$saltHex$hashHex` — versioned so we can
 * migrate algorithms later without breaking existing hashes.
 */

import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const ITERATIONS = 600_000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, iterStr, saltHex, hashHex] = stored.split("$");
    if (scheme !== "pbkdf2" || !iterStr || !saltHex || !hashHex) return false;
    const iterations = parseInt(iterStr, 10);
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Constant-time random token generator — for refresh tokens, API keys, etc.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash a token for storage. We never store raw refresh tokens or API keys —
 * only their SHA-256 hashes, so a database leak cannot be replayed.
 */
export function hashToken(token: string): string {
  return pbkdf2Sync(token, "", 1, KEY_LENGTH, DIGEST).toString("hex");
}
