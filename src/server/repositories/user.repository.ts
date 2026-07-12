/**
 * User repository — data access for the User model.
 *
 * Repository pattern keeps SQL isolated from business logic. The service
 * layer (`authService`) calls these methods; route handlers never touch
 * Prisma directly.
 */

import { db } from "@/lib/db";
import type { User, UserRole } from "@prisma/client";

export interface CreateUserInput {
  email: string;
  name?: string;
  passwordHash: string;
  role?: UserRole;
}

export const userRepository = {
  findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email: email.toLowerCase() } });
  },

  findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  },

  create(input: CreateUserInput): Promise<User> {
    return db.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role ?? "USER",
      },
    });
  },

  updateLastLogin(id: string): Promise<User> {
    return db.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  },

  setEmailVerified(id: string): Promise<User> {
    return db.user.update({
      where: { id },
      data: { emailVerified: new Date() },
    });
  },

  count(): Promise<number> {
    return db.user.count();
  },
};

/**
 * Refresh token repository — stores hashed refresh tokens for rotation.
 */
export const refreshTokenRepository = {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }) {
    return db.refreshToken.create({ data: input });
  },

  findByHash(tokenHash: string) {
    return db.refreshToken.findUnique({ where: { tokenHash } });
  },

  revoke(id: string) {
    return db.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId: string) {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};

/**
 * Audit log repository — append-only audit trail.
 */
export const auditLogRepository = {
  record(input: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
    before?: unknown;
    after?: unknown;
  }) {
    return db.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action as never,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before ? JSON.stringify(input.before) : null,
        after: input.after ? JSON.stringify(input.after) : null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  },

  list(limit = 50) {
    return db.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    });
  },
};
