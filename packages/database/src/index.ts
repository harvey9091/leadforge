/**
 * =============================================================================
 * @leadforge/database — Database access layer
 * =============================================================================
 *
 * Phase 1: the Prisma schema lives at /prisma/schema.prisma and the
 * client is exported from /src/lib/db.ts. In Phase 2, when the Fastify
 * API service is split out, this package becomes the single source of
 * truth for:
 *  - Prisma schema
 *  - Prisma client singleton
 *  - Repository implementations
 *  - Migration scripts
 *
 * The runtime app (this repo) imports from "@/lib/db" which is the
 * Phase 1 implementation. The package re-exports so future services
 * can import from "@leadforge/database" without duplication.
 * =============================================================================
 */

export { db } from "../../../src/lib/db";
