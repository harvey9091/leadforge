/**
 * GET  /api/v1/settings/freellm — load current FreeLLM config (API key redacted)
 * POST /api/v1/settings/freellm — save FreeLLM config (API key encrypted before storage)
 */

import { db } from "@/lib/db";
import {
  loadFreeLLMConfig,
  saveFreeLLMConfig,
  clearFreeLLMConfig,
  encryptApiKey,
  decryptApiKey,
} from "@/server/ai/freellm-settings";
import { integrationManager } from "@/server/integrations/manager";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { AppError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const row = await db.freeLLMConfig.findUnique({ where: { id: "singleton" } });
    const cfg = await loadFreeLLMConfig();

    return apiSuccess({
      configured: !!(cfg.baseUrl && cfg.apiKey),
      baseUrl: cfg.baseUrl,
      model: cfg.model === "default" ? "auto" : cfg.model,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      timeout: cfg.timeout,
      streaming: cfg.streaming,
      apiKeySet: !!row?.apiKeyEnc,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await req.json();

    const baseUrl = (body.baseUrl ?? "").trim();
    const apiKey = (body.apiKey ?? "").trim();
    const model = (body.model ?? "auto").trim() || "auto";
    const temperature = clamp(parseFloat(body.temperature ?? "0.3"), 0, 2, 0.3);
    const maxTokens = clampInt(parseInt(body.maxTokens ?? "4000", 10), 1, 1_000_000, 4000);
    const timeout = clampInt(parseInt(body.timeout ?? "60000", 10), 1000, 600_000, 60000);
    const streaming = Boolean(body.streaming);

    if (!baseUrl) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Base URL is required", status: 400 });
    }

    const integration = integrationManager.get("freellm");
    if (integration) {
      const existing = await integration.loadConfiguration();
      const finalKey = apiKey || existing?.apiKey || "";

      await integrationManager.saveConfiguration("freellm", {
        id: "freellm",
        name: "FreeLLM",
        description: "LLM gateway for AI qualification",
        icon: "sparkles",
        baseUrl,
        apiKey: finalKey,
        enabled: true,
        timeout,
        maxRetries: 3,
        updatedAt: new Date().toISOString(),
      });
    }

    const existingRow = await db.freeLLMConfig.findUnique({ where: { id: "singleton" } });

    await saveFreeLLMConfig({
      baseUrl,
      apiKey: apiKey || (existingRow ? decryptApiKey(existingRow.apiKeyEnc) : ""),
      model: model === "default" ? "auto" : model,
      temperature,
      maxTokens,
      timeout,
      streaming,
    });

    return apiSuccess(
      { ok: true, message: "FreeLLM configuration saved" },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err);
  }
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return Math.floor(value);
}
