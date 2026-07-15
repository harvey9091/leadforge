/**
 * POST /api/v1/integrations/validate
 * Validate all integrations on startup.
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiSuccess, apiError, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function POST() {
  const ctx = getRequestContext();
  try {
    const results = await integrationManager.validateAll();
    const errors = results.filter((r) => !r.valid);
    const warnings = results.filter((r) => r.warning);

    return apiSuccess(
      {
        valid: errors.length === 0,
        results,
        errorCount: errors.length,
        warningCount: warnings.length,
        errors: errors.map((e) => ({
          integration: e.id,
          errors: e.errors,
          warning: e.warning,
        })),
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err);
  }
}
