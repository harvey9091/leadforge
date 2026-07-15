/**
 * =============================================================================
 * ChromaDB Integration
 * =============================================================================
 *
 * Connects to a ChromaDB instance for vector search and semantic similarity.
 * Used for finding similar companies based on embeddings.
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import type { IIntegration, IntegrationHealth, IntegrationConfig, IntegrationTestResult } from "./base";

const ID = "chromadb";

export const ChromaDBIntegration: IIntegration = {
  id: ID,
  name: "ChromaDB",
  description: "Vector database for semantic search and similarity matching.",
  capabilities: {
    healthCheck: true,
    testConnection: true,
    metrics: ["collectionCount", "documentCount"],
  },

  getDefaultConfig(): IntegrationConfig {
    return {
      id: ID,
      name: "ChromaDB",
      description: "Vector database for semantic search",
      icon: "scan",
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
    logger.info("integrations.chromadb.connect", { baseUrl: config.baseUrl });
  },

  async disconnect(): Promise<void> {
    logger.info("integrations.chromadb.disconnect");
  },

  async healthCheck(): Promise<IntegrationHealth> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return {
        status: "disconnected",
        error: "ChromaDB URL not configured",
        lastChecked: new Date().toISOString(),
      };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${config.baseUrl}/api/v1/heartbeat`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
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
      return { success: false, error: "ChromaDB URL not configured" };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${config.baseUrl}/api/v1/heartbeat`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
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
      errors.push("ChromaDB URL is required when ChromaDB is enabled");
    }

    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push("ChromaDB URL must be a valid URL");
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
        name: "ChromaDB",
        description: this.description,
        icon: "scan",
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
