/**
 * POST /api/v1/settings/freellm/models
 * Discover available models from a FreeLLM-compatible endpoint.
 */

import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { AppError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await req.json();
    const baseUrl = (body.baseUrl ?? "").trim().replace(/\/+$/, "").replace(/\/v1$/, "");
    const apiKey = (body.apiKey ?? "").trim();

    if (!baseUrl) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Base URL is required", status: 400 });
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey || "none"}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return apiSuccess({
        success: false,
        latencyMs,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      }, { requestId: ctx.requestId });
    }

    const data = await response.json() as { data?: Array<{ id?: string }> };
    const models = (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => !!id);

    return apiSuccess({
      success: models.length > 0,
      models,
      latencyMs,
      error: models.length === 0 ? "No models returned from API" : undefined,
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiSuccess({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { requestId: ctx.requestId });
  }
}
