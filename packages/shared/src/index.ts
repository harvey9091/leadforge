/**
 * =============================================================================
 * @leadforge/shared — Shared types, schemas, and utilities
 * =============================================================================
 *
 * Imported by:
 *  - Dashboard (this repo)
 *  - API (apps/api, Phase 2)
 *  - Workers (workers/*, Phase 2)
 *
 * Contains:
 *  - Type definitions for all domain entities
 *  - Zod schemas for API request/response validation
 *  - Pure utility functions (formatting, parsing)
 *  - Constants (nav config, source types, etc.)
 *
 * Phase 1: types are mirrored in /src/types/index.ts. Phase 2 will make
 * this package the canonical source.
 * =============================================================================
 */

export * from "../../../src/types";
export * from "../../../src/server/utils/schemas";
export * from "../../../src/lib/utils";
