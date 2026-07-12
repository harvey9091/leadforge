/**
 * GET /api/v1/config — get configuration diagnostics + validation
 * POST /api/v1/config?export=true — export configuration
 */
import { validateConfig, getConfigDiagnostics, exportConfig } from "@/server/reliability/config-manager";
import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  const url = new URL(req.url);
  if (url.searchParams.get("export") === "true") {
    const config = exportConfig();
    return apiSuccess(config, { requestId: ctx.requestId });
  }
  const validation = validateConfig();
  const diagnostics = getConfigDiagnostics();
  return apiSuccess({ validation, diagnostics }, { requestId: ctx.requestId });
}
