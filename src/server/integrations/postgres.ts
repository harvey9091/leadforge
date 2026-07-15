/**
 * =============================================================================
 * PostgreSQL Integration
 * =============================================================================
 *
 * Health check and connection validation for PostgreSQL datastore.
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import type { IIntegration, IntegrationHealth, IntegrationConfig, IntegrationTestResult } from "./base";

const ID = "postgresql";

export const PostgreSQLIntegration: IIntegration = {
  id: ID,
  name: "PostgreSQL",
  description: "Primary datastore for companies, people, leads, and workspace data.",
  capabilities: {
    healthCheck: true,
    testConnection: true,
    metrics: ["connections", "databaseSize", "version"],
  },

  getDefaultConfig(): IntegrationConfig {
    return {
      id: ID,
      name: "PostgreSQL",
      description: "Primary datastore",
      icon: "database",
      baseUrl: "",
      apiKey: "",
      enabled: false,
      timeout: 5000,
      maxRetries: 2,
      updatedAt: new Date().toISOString(),
    };
  },

  async connect(): Promise<void> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) return;
    logger.info("integrations.postgres.connect", { baseUrl: config.baseUrl.replace(/\/\/.*@/, "//***@") });
  },

  async disconnect(): Promise<void> {
    logger.info("integrations.postgres.disconnect");
  },

  async healthCheck(): Promise<IntegrationHealth> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return {
        status: "disconnected",
        error: "PostgreSQL URL not configured",
        lastChecked: new Date().toISOString(),
      };
    }

    const start = performance.now();
    try {
      const url = new URL(config.baseUrl);
      const host = url.hostname;
      const port = url.port || "5432";

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`http://${host}:${port}`, {
          method: "GET",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutHandle);

        const latencyMs = Math.round(performance.now() - start);

        return {
          status: response.ok || response.status === 401 ? "connected" : "error",
          latencyMs,
          error: response.ok ? undefined : `HTTP ${response.status}`,
          lastChecked: new Date().toISOString(),
          lastSuccessAt: response.ok ? new Date().toISOString() : undefined,
        };
      } catch {
        clearTimeout(timeoutHandle);
        throw new Error(`Cannot reach PostgreSQL at ${host}:${port}`);
      }
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
      return { success: false, error: "PostgreSQL URL not configured" };
    }

    const start = performance.now();
    try {
      const health = await this.healthCheck();
      const latencyMs = health.latencyMs ?? Math.round(performance.now() - start);

      return {
        success: health.status === "connected",
        latencyMs,
        error: health.error,
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
      errors.push("PostgreSQL URL is required when PostgreSQL is enabled");
    }

    if (config.baseUrl && !config.baseUrl.startsWith("postgresql://") && !config.baseUrl.startsWith("postgres://")) {
      errors.push("PostgreSQL URL must start with postgresql:// or postgres://");
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
        name: "PostgreSQL",
        description: this.description,
        icon: "database",
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
