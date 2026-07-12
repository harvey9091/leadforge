/**
 * GET /api/v1/sources
 * List all available discovery sources with metadata.
 */

import { SOURCE_METADATA } from "@/server/discovery/registry";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  return apiSuccess(
    {
      data: SOURCE_METADATA.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        rateLimitPerSec: s.rateLimitPerSec,
      })),
    },
    { requestId: ctx.requestId }
  );
}
