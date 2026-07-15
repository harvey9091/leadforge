/**
 * =============================================================================
 * FreeLLM Integration
 * =============================================================================
 *
 * Connects to a FreeLLM-compatible LLM gateway (OpenAI-compatible API).
 * Supports model discovery, connection testing, and configuration.
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import type { IIntegration, IntegrationHealth, IntegrationConfig, IntegrationTestResult } from "./base";

const ID = "freellm";

export const FreeLLMIntegration: IIntegration = {
  id: ID,
  name: "FreeLLM",
  description: "LLM gateway for AI qualification and ICP analysis.",
  capabilities: {
    healthCheck: true,
    testConnection: true,
    modelsList: true,
    metrics: ["latencyMs", "model", "tokenUsage"],
  },

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
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey || "none"}`,
        },
        body: JSON.stringify({
          model: "default",
          messages: [{ role: "user", content: "OK" }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutHandle);

      const latencyMs = Math.round(performance.now() - start);

      return {
        status: response.ok ? "connected" : "error",
        latencyMs,
        error: response.ok ? undefined : `HTTP ${response.status}`,
        lastChecked: new Date().toISOString(),
        lastSuccessAt: response.ok ? new Date().toISOString() : undefined,
      };
    } catch (err) {
      return {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        lastChecked: new Date().toISOString(),
      };
    }
  },

  async test(_overrides?: Partial<IntegrationConfig>): Promise<IntegrationTestResult> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return { success: false, error: "FreeLLM URL not configured" };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), Math.min(config.timeout, 15000));

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey || "none"}`,
        },
        body: JSON.stringify({
          model: "default",
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutHandle);

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          success: false,
          latencyMs,
          error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        };
      }

      const data = await response.json() as { model?: string; choices?: Array<{ message?: { content?: string } }> };

      return {
        success: true,
        latencyMs,
        version: data.model,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
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
        errors.push("Base URL must be a valid URL");
      }
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 600000)) {
      errors.push("Timeout must be between 1000ms and 600000ms");
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
      const row = await loadIntegrationConfig(ID);
      if (!row) return null;
      return {
        id: ID,
        name: "FreeLLM",
        description: this.description,
        icon: "sparkles",
        baseUrl: row.baseUrl,
        apiKey: row.apiKeyEnc,
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
