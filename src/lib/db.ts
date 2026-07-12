import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reloads modules which would otherwise leak
 * PrismaClient instances (each holding ~10 connections). We stash the client
 * on globalThis to survive HMR.
 *
 * Production environments (Docker Compose / Oracle Cloud) use the same
 * singleton pattern but rely on Prisma's built-in connection pooling.
 *
 * Logging:
 *  - dev: warnings + errors only (queries are too noisy for a dashboard)
 *  - prod: errors only
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const logLevel: ("query" | "info" | "warn" | "error")[] =
  process.env.NODE_ENV === "production"
    ? ["error"]
    : ["warn", "error"];

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevel,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
