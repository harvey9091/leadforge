/**
 * GET  /api/v1/integrations/[id]   — get integration config
 * POST /api/v1/integrations/[id]   — save integration config
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiSuccess, apiError, getRequestContext } from "@/server/utils/api";
import { AppError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = getRequestContext(_req);
  try {
    const id = params.id;
    const integration = integrationManager.get(id);

    if (!integration) {
      throw new AppError({ code: "NOT_FOUND", message: `Integration not found: ${id}`, status: 404 });
    }

    const config = await integration.loadConfiguration();
    const defaultConfig = integration.getDefaultConfig();

    if (!config) {
      return apiSuccess({ ...defaultConfig, configured: false }, { requestId: ctx.requestId });
    }

    return apiSuccess(
      {
        ...config,
        configured: !!(config.baseUrl || config.apiKey),
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = getRequestContext(req);
  try {
    const id = params.id;
    const integration = integrationManager.get(id);

    if (!integration) {
      throw new AppError({ code: "NOT_FOUND", message: `Integration not found: ${id}`, status: 404 });
    }

    const body = await req.json();

    const validation = integration.validate(body);
    if (!validation.valid) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: validation.errors.join("; "),
        status: 400,
        details: { errors: validation.errors },
      });
    }

    const existing = await integration.loadConfiguration();
    const defaultConfig = integration.getDefaultConfig();

    const config = {
      id,
      name: integration.name,
      description: integration.description,
      icon: defaultConfig.icon,
      baseUrl: (body.baseUrl ?? existing?.baseUrl ?? "").trim(),
      apiKey: body.apiKey ?? existing?.apiKey ?? "",
      enabled: body.enabled ?? existing?.enabled ?? false,
      timeout: body.timeout ?? existing?.timeout ?? defaultConfig.timeout,
      maxRetries: body.maxRetries ?? existing?.maxRetries ?? defaultConfig.maxRetries,
      updatedAt: new Date().toISOString(),
    };

    await integrationManager.saveConfiguration(id, config);

    return apiSuccess(
      { ok: true, message: `${integration.name} configuration saved` },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err);
  }
}
