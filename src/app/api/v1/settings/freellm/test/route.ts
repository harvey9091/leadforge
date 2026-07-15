/**
 * POST /api/v1/settings/freellm/test
 * Test a FreeLLM connection with provided credentials (does NOT persist).
 */

import { integrationManager } from "@/server/integrations/manager";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { AppError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await req.json();
    const baseUrl = (body.baseUrl ?? "").trim().replace(/\/+$/, "");
    const apiKey = (body.apiKey ?? "").trim();
    const model = (body.model ?? "default").trim() || "default";

    if (!baseUrl || !apiKey) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Base URL and API Key are required to test connection", status: 400 });
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 5,
      }),
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

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; model?: string };
    const returnedModel = data.model ?? model;

    return apiSuccess({
      success: true,
      latencyMs,
      model: returnedModel,
    }, { requestId: ctx.requestId });
  } catch (err) {
    return apiSuccess({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { requestId: ctx.requestId });
  }
}
