/**
 * POST /api/v1/ai/test
 * Test FreeLLM connection.
 */

import { testConnection } from "@/server/ai/freellm-client";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  const result = await testConnection();
  return apiSuccess(result, { requestId: ctx.requestId });
}
