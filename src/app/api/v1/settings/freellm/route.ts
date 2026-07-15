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
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { AppError } from "@/server/utils/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cfg = await loadFreeLLMConfig();

    const row = await db.freeLLMConfig.findUnique({ where: { id: "singleton" } });

    return apiSuccess({
      configured: !!(cfg.baseUrl && cfg.apiKey),
      baseUrl: cfg.baseUrl,
      model: cfg.model,
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
    const model = (body.model ?? "default").trim() || "default";
    const temperature = clamp(parseFloat(body.temperature ?? "0.3"), 0, 2, 0.3);
    const maxTokens = clampInt(parseInt(body.maxTokens ?? "4000", 10), 1, 1_000_000, 4000);
    const timeout = clampInt(parseInt(body.timeout ?? "60000", 10), 1000, 600_000, 60000);
    const streaming = Boolean(body.streaming);

    if (!baseUrl) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Base URL is required", status: 400 });
    }

    const newEncryptedKey = apiKey ? encryptApiKey(apiKey) : "";

    const existing = await db.freeLLMConfig.findUnique({ where: { id: "singleton" } });

    if (!baseUrl && !apiKey && existing) {
      await clearFreeLLMConfig();
      return apiSuccess({ ok: true, message: "FreeLLM config cleared" }, { requestId: ctx.requestId });
    }

    const finalKey = apiKey
      ? newEncryptedKey
      : existing?.apiKeyEnc ?? "";

    await saveFreeLLMConfig({
      baseUrl,
      apiKey: apiKey || (existing ? decryptApiKey(existing.apiKeyEnc) : ""),
      model,
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
