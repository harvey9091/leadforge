/**
 * =============================================================================
 * FreeLLM Integration
 * =============================================================================
 *
 * Connects to a FreeLLM-compatible LLM gateway (OpenAI-compatible API).
 * Supports model discovery, connection testing, and configuration.
 *
 * Model handling:
 *  - The UI label "Auto (server default)" maps to the API value "auto".
 *  - Never sends "default" — the server rejects it.
 *  - Discovered models are fetched dynamically from GET {baseUrl}/v1/models.
 * =============================================================================
 */

import { fetchWithRetry } from "@/server/discovery/http-client";
import { logger } from "@/server/utils/logger";
import {
  classifyHttpError,
  classifyNetworkError,
} from "@/server/integrations/diagnostics";
import type {
  IIntegration,
  IntegrationHealth,
  IntegrationConfig,
  IntegrationTestResult,
  DiscoveredModel,
} from "./base";

const ID = "freellm";

const capabilities = {
  healthCheck: true,
  testConnection: true,
  modelsList: true,
  requiresAuth: true,
  discoverModelsPath: "/v1/models",
  metrics: ["latencyMs", "model", "tokenUsage"],
} as const;

export const FreeLLMIntegration: IIntegration = {
  id: ID,
  name: "FreeLLM",
  description: "LLM gateway for AI qualification and ICP analysis.",
  capabilities,

  getDefaultConfig(): IntegrationConfig {
    return {
      id: ID,
      name: "FreeLLM",
      description: "LLM gateway for AI qualification",
      icon: "sparkles",
      baseUrl: "",
      apiKey: "",
      enabled: false,
      timeout: 60000,
      maxRetries: 3,
      updatedAt: new Date().toISOString(),
    };
  },

  async connect(): Promise<void> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) return;
    logger.info("integrations.freellm.connect", { baseUrl: config.baseUrl });
  },

  async disconnect(): Promise<void> {
    logger.info("integrations.freellm.disconnect");
  },

  async healthCheck(): Promise<IntegrationHealth> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return {
        status: "disconnected",
        error: "FreeLLM URL not configured",
        lastChecked: new Date().toISOString(),
      };
    }

    const start = performance.now();
    try {
      const result = await checkFreeLLMHealth(config.baseUrl, config.apiKey, config.timeout);
      const latencyMs = Math.round(performance.now() - start);

      if (!result.ok) {
        const classified = result.status > 0
          ? classifyHttpError(result.status, result.statusText, typeof result.body === "string" ? result.body : undefined, ID)
          : classifyNetworkError(new Error(result.statusText), ID);

        return {
          status: "error",
          latencyMs,
          error: classified.message,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: "connected",
        latencyMs,
        lastChecked: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
      };
    } catch (err) {
      const classified = classifyNetworkError(err, ID);
      return {
        status: "error",
        error: classified.message,
        lastChecked: new Date().toISOString(),
      };
    }
  },

  async test(_overrides?: Partial<IntegrationConfig>): Promise<IntegrationTestResult> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return { success: false, error: "FreeLLM URL not configured — enter a Base URL in the Configure dialog" };
    }

    const start = performance.now();
    try {
      const result = await testFreeLLMConnection(config.baseUrl, config.apiKey, config.timeout);
      const latencyMs = Math.round(performance.now() - start);

      if (!result.ok) {
        const classified = result.status > 0
          ? classifyHttpError(result.status, result.statusText, typeof result.body === "string" ? result.body : undefined, ID)
          : classifyNetworkError(new Error(result.statusText), ID);

        return {
          success: false,
          latencyMs,
          error: classified.message,
          httpStatus: result.status || 0,
          statusText: result.statusText,
        };
      }

      return {
        success: true,
        latencyMs,
        version: result.version,
      };
    } catch (err) {
      const classified = classifyNetworkError(err, ID);
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        error: classified.message,
      };
    }
  },

  async discoverModels(_overrides?: Partial<IntegrationConfig>): Promise<DiscoveredModel[]> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) return [];

    try {
      const baseUrl = config.baseUrl.replace(/\/+$/, "");
      const result = await fetchWithRetry(`${baseUrl}/v1/models`, {
        method: "GET",
        timeoutMs: Math.min(config.timeout, 10000),
        maxRetries: 1,
        headers: {
          Accept: "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        responseType: "json",
        allowStatuses: [200, 401, 403],
      });

      if (!result.ok) {
        logger.warn("integrations.freellm.discoverModels.failed", {
          status: result.status,
          statusText: result.statusText,
        });
        return [];
      }

      const body = result.body as { data?: Array<{ id?: string }> };
      const models = (body.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => !!id);

      return [
        { id: "auto", label: "Auto (server default)", isDefault: true },
        ...models.map((id) => ({ id, label: id })),
      ];
    } catch (err) {
      logger.warn("integrations.freellm.discoverModels.error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [{ id: "auto", label: "Auto (server default)", isDefault: true }];
    }
  },

  validate(config: Partial<IntegrationConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.enabled && !config.baseUrl) {
      errors.push("Base URL is required when FreeLLM is enabled");
    }

    if (config.baseUrl) {
      try {
        const url = new URL(config.baseUrl);
        if (!url.protocol.startsWith("http")) {
          errors.push("Base URL must use http or https");
        }
      } catch {
        errors.push("Base URL must be a valid URL (e.g. http://68.233.114.213:3002/v1)");
      }
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 600000)) {
      errors.push("Timeout must be between 1000ms and 600000ms");
    }

    if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
      errors.push("Max retries must be between 0 and 10");
    }

    return { valid: errors.length === 0, errors };
  },

  async saveConfiguration(config: IntegrationConfig): Promise<void> {
    const { saveIntegrationConfig } = await import("@/server/repositories/integration.repository");
    await saveIntegrationConfig(ID, {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      enabled: config.enabled,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  },

  async loadConfiguration(): Promise<IntegrationConfig | null> {
    try {
      const { loadIntegrationConfig } = await import("@/server/repositories/integration.repository");
      const { decryptApiKey } = await import("@/server/ai/freellm-settings");
      const row = await loadIntegrationConfig(ID);
      if (!row) return null;
      return {
        id: ID,
        name: "FreeLLM",
        description: this.description,
        icon: "sparkles",
        baseUrl: row.baseUrl,
        apiKey: decryptApiKey(row.apiKeyEnc),
        enabled: row.enabled,
        timeout: row.timeout,
        maxRetries: row.maxRetries,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
};

interface FreeLLMHealthResult {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
  version?: string;
}

async function checkFreeLLMHealth(
  baseUrl: string,
  apiKey: string | undefined,
  timeout: number
): Promise<FreeLLMHealthResult> {
  const result = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: "POST",
    timeoutMs: Math.min(timeout, 15000),
    maxRetries: 1,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: {
      model: "auto",
      messages: [{ role: "user", content: "OK" }],
      max_tokens: 1,
    },
    responseType: "json",
    allowStatuses: [200, 401, 403, 404, 422],
  });

  return {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    body: result.body,
    version: extractModelFromResponse(result.body),
  };
}

async function testFreeLLMConnection(
  baseUrl: string,
  apiKey: string | undefined,
  timeout: number
): Promise<FreeLLMHealthResult> {
  const result = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: "POST",
    timeoutMs: Math.min(timeout, 15000),
    maxRetries: 1,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: {
      model: "auto",
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 5,
    },
    responseType: "json",
    allowStatuses: [200, 401, 403, 404, 422],
  });

  return {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    body: result.body,
    version: extractModelFromResponse(result.body),
  };
}

function extractModelFromResponse(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.model === "string") return obj.model;
  if (obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.model === "string") return data.model;
  }
  return undefined;
}
