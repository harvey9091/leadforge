/**
 * Auth service — business logic for authentication flows.
 *
 * Responsibilities:
 *  - Register: create user, hash password, issue tokens, audit
 *  - Login: verify credentials, issue tokens, audit
 *  - Refresh: rotate refresh token, issue new access token
 *  - Logout: revoke refresh token
 *
 * Token strategy:
 *  - Access token: JWT, 15min, stateless, sent in response body + httpOnly cookie
 *  - Refresh token: opaque random string, 30d, stored hashed in DB, rotated on use
 */

import { userRepository, refreshTokenRepository, auditLogRepository } from "@/server/repositories/user.repository";
import { hashPassword, verifyPassword, generateToken, hashToken } from "@/server/utils/crypto";
import { signJwt, verifyJwt } from "@/server/utils/jwt";
import { env } from "@/server/config/env";
import { AuthError, ConflictError, ValidationError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { User } from "@prisma/client";

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type SafeUser = Omit<User, "passwordHash">;

function sanitize(user: User): SafeUser {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

function issueTokens(user: User): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const accessToken = signJwt({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = generateToken(32);
  return { accessToken, refreshToken, expiresIn: env.jwt.expiresIn };
}

async function persistRefreshToken(
  userId: string,
  refreshToken: string,
  meta: { userAgent?: string; ip?: string }
) {
  await refreshTokenRepository.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.jwt.refreshExpiresIn * 1000),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
}

export const authService = {
  async register(input: {
    email: string;
    password: string;
    name?: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();
    if (input.password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError("An account with this email already exists");

    // First user becomes admin (single-tenant Phase 1 bootstrapping).
    const isFirst = (await userRepository.count()) === 0;
    const user = await userRepository.create({
      email,
      name: input.name?.trim() || null,
      passwordHash: hashPassword(input.password),
      role: isFirst ? "ADMIN" : "USER",
    });

    const tokens = issueTokens(user);
    await persistRefreshToken(user.id, tokens.refreshToken, {
      userAgent: input.userAgent,
      ip: input.ip,
    });
    await userRepository.updateLastLogin(user.id);
    await auditLogRepository.record({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
      after: { email: user.email, role: user.role, firstUser: isFirst },
    });

    logger.info("user.registered", { userId: user.id, email: user.email, role: user.role });
    return { user: sanitize(user), ...tokens };
  },

  async login(input: {
    email: string;
    password: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();
    const user = await userRepository.findByEmail(email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthError("Invalid email or password");
    }

    const tokens = issueTokens(user);
    await persistRefreshToken(user.id, tokens.refreshToken, {
      userAgent: input.userAgent,
      ip: input.ip,
    });
    await userRepository.updateLastLogin(user.id);
    await auditLogRepository.record({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    logger.info("user.loggedIn", { userId: user.id, email: user.email });
    return { user: sanitize(user), ...tokens };
  },

  async refresh(input: { refreshToken: string; userAgent?: string; ip?: string }): Promise<AuthResult> {
    const stored = await refreshTokenRepository.findByHash(hashToken(input.refreshToken));
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AuthError("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(stored.userId);
    if (!user) throw new AuthError("User not found");

    // Rotate: revoke the old token, issue a new pair.
    await refreshTokenRepository.revoke(stored.id);
    const tokens = issueTokens(user);
    await persistRefreshToken(user.id, tokens.refreshToken, {
      userAgent: input.userAgent,
      ip: input.ip,
    });

    return { user: sanitize(user), ...tokens };
  },

  async logout(refreshToken: string): Promise<void> {
    const stored = await refreshTokenRepository.findByHash(hashToken(refreshToken));
    if (stored && !stored.revokedAt) {
      await refreshTokenRepository.revoke(stored.id);
      await auditLogRepository.record({
        userId: stored.userId,
        action: "LOGOUT",
        entity: "User",
        entityId: stored.userId,
      });
    }
  },

  /** Verify an access token from the Authorization header. */
  verifyAccessToken(token: string): SafeUser {
    const payload = verifyJwt(token);
    if (payload.type !== "access") throw new AuthError("Wrong token type");
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as "ADMIN" | "USER",
      name: null,
      avatarUrl: null,
      emailVerified: null,
      lastLoginAt: null,
      createdAt: new Date(payload.iat * 1000),
      updatedAt: new Date(payload.iat * 1000),
    } as SafeUser;
  },
};
