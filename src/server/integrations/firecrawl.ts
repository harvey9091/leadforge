/**
 * =============================================================================
 * Firecrawl Integration
 * =============================================================================
 *
 * Connects to a Firecrawl instance (running on Server 2).
 * Supports the /v1/health and /v1/scrape endpoints.
 * =============================================================================
 */

import { fetchWithRetry } from "@/server/discovery/http-client";
import { logger } from "@/server/utils/logger";
import type { IIntegration, IntegrationHealth, IntegrationConfig, IntegrationTestResult, IntegrationCapabilities } from "./base";

const ID = "firecrawl";

const capabilities: IntegrationCapabilities = {
  healthCheck: true,
  testConnection: true,
  versionEndpoint: "/v1/health",
  metrics: ["latencyMs", "version", "available"],
};

export const FirecrawlIntegration: IIntegration = {
  id: ID,
  name: "Firecrawl",
  description: "Web scraping and content extraction for company enrichment.",
  capabilities,

  getDefaultConfig(): IntegrationConfig {
    return {
      id: ID,
      name: "Firecrawl",
      description: "Web scraping and content extraction",
      icon: "globe",
      baseUrl: "",
      apiKey: "",
      enabled: false,
      timeout: 30000,
      maxRetries: 2,
      updatedAt: new Date().toISOString(),
    };
  },

  async connect(): Promise<void> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) return;
    logger.info("integrations.firecrawl.connect", { baseUrl: config.baseUrl });
  },

  async disconnect(): Promise<void> {
    logger.info("integrations.firecrawl.disconnect");
  },

  async healthCheck(): Promise<IntegrationHealth> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return {
        status: "disconnected",
        error: "Firecrawl URL not configured",
        lastChecked: new Date().toISOString(),
      };
    }

    const start = performance.now();
    try {
      const result = await fetchWithRetry(`${config.baseUrl}/v1/health`, {
        timeoutMs: 5000,
        maxRetries: 1,
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });

      const latencyMs = Math.round(performance.now() - start);
      let version: string | undefined;

      if (result.ok) {
        try {
          const body = result.body as { version?: string; data?: { version?: string } };
          version = body.version ?? body.data?.version;
        } catch { /* ignore */ }
      }

      return {
        status: result.ok ? "connected" : "error",
        latencyMs,
        version,
        error: result.ok ? undefined : `HTTP ${result.status}`,
        lastChecked: new Date().toISOString(),
        lastSuccessAt: result.ok ? new Date().toISOString() : undefined,
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
      return { success: false, error: "Firecrawl URL not configured" };
    }

    const start = performance.now();
    try {
      const result = await fetchWithRetry(`${config.baseUrl}/v1/health`, {
        timeoutMs: 10000,
        maxRetries: 1,
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });

      const latencyMs = Math.round(performance.now() - start);
      let version: string | undefined;

      if (result.ok) {
        try {
          const body = result.body as { version?: string; data?: { version?: string } };
          version = body.version ?? body.data?.version;
        } catch { /* ignore */ }
      }

      if (!result.ok) {
        return {
          success: false,
          latencyMs,
          error: `HTTP ${result.status}: ${result.statusText}`,
        };
      }

      return { success: true, latencyMs, version };
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
      errors.push("Base URL is required when Firecrawl is enabled");
    }

    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push("Base URL must be a valid URL");
      }
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      errors.push("Timeout must be between 1000ms and 300000ms");
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
        name: "Firecrawl",
        description: this.description,
        icon: "globe",
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
