/**
 * =============================================================================
 * SearXNG Integration
 * =============================================================================
 *
 * Connects to a SearXNG instance for privacy-respecting web search.
 * Used as an alternative to Google/Bing for company discovery.
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import type { IIntegration, IntegrationHealth, IntegrationConfig, IntegrationTestResult } from "./base";

const ID = "searxng";

export const SearXNGIntegration: IIntegration = {
  id: ID,
  name: "SearXNG",
  description: "Privacy-respecting meta-search engine for company discovery.",
  capabilities: {
    healthCheck: true,
    testConnection: true,
  },

  getDefaultConfig(): IntegrationConfig {
    return {
      id: ID,
      name: "SearXNG",
      description: "Privacy-respecting meta-search engine",
      icon: "search",
      baseUrl: "",
      apiKey: "",
      enabled: false,
      timeout: 15000,
      maxRetries: 2,
      updatedAt: new Date().toISOString(),
    };
  },

  async connect(): Promise<void> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) return;
    logger.info("integrations.searxng.connect", { baseUrl: config.baseUrl });
  },

  async disconnect(): Promise<void> {
    logger.info("integrations.searxng.disconnect");
  },

  async healthCheck(): Promise<IntegrationHealth> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return {
        status: "disconnected",
        error: "SearXNG URL not configured",
        lastChecked: new Date().toISOString(),
      };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${config.baseUrl}/search?q=test&format=json`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
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
      return { success: false, error: "SearXNG URL not configured" };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${config.baseUrl}/search?q=test&format=json`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutHandle);

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { success: true, latencyMs };
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
      errors.push("SearXNG URL is required when SearXNG is enabled");
    }

    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push("SearXNG URL must be a valid URL");
      }
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
        name: "SearXNG",
        description: this.description,
        icon: "search",
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
