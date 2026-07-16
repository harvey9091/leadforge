/**
 * POST /api/v1/settings/freellm/test
 * Test a FreeLLM connection with provided credentials (does NOT persist).
 *
 * API key is optional — only required if the instance has authentication enabled.
 * Model is always sent as "auto" (server default) to avoid "default" rejection.
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
    const model = (body.model ?? "auto").trim() || "auto";

    if (!baseUrl) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Base URL is required to test connection", status: 400 });
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
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
      let classifiedError: string;

      if (response.status === 401) {
        classifiedError = `Invalid API Key (401): The server rejected the supplied key. ${errorText.slice(0, 100)}`;
      } else if (response.status === 403) {
        classifiedError = `Access Forbidden (403): Insufficient permissions. ${errorText.slice(0, 100)}`;
      } else if (response.status === 404) {
        classifiedError = `Not Found (404): Endpoint not found — check Base URL. ${errorText.slice(0, 100)}`;
      } else if (response.status >= 500) {
        classifiedError = `Server Error (${response.status}): The LLM server is experiencing issues. ${errorText.slice(0, 100)}`;
      } else {
        classifiedError = `HTTP ${response.status}: ${errorText.slice(0, 200)}`;
      }

      return apiSuccess({
        success: false,
        latencyMs,
        error: classifiedError,
        httpStatus: response.status,
        statusText: response.statusText,
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    let classifiedError: string;

    if (errorMessage.includes("abort") || errorMessage.includes("aborted")) {
      classifiedError = `Request timed out: The server did not respond within 15 seconds. Check the Base URL and network connectivity.`;
    } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
      classifiedError = `DNS resolution failed: Cannot resolve hostname. Check the Base URL for typos.`;
    } else if (errorMessage.includes("ECONNREFUSED")) {
      classifiedError = `Connection refused: The server is not running or the port is closed. Check that Server 2 is running on port 3002.`;
    } else if (errorMessage.includes("ECONNRESET")) {
      classifiedError = `Connection reset: The server closed the connection unexpectedly.`;
    } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
      classifiedError = `Request timed out: The server took too long to respond. Check network connectivity.`;
    } else if (errorMessage.includes("CERT") || errorMessage.includes("SSL") || errorMessage.includes("TLS")) {
      classifiedError = `TLS/SSL error: Certificate validation failed. If using HTTP, ensure the URL starts with http:// not https://.`;
    } else {
      classifiedError = `Network error: ${errorMessage}. Check that the Base URL is correct and the server is reachable.`;
    }

    return apiSuccess({
      success: false,
      error: classifiedError,
    }, { requestId: ctx.requestId });
  }
}
