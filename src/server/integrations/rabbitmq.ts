/**
 * =============================================================================
 * RabbitMQ Integration
 * =============================================================================
 *
 * Health check and connection validation for RabbitMQ message queue.
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import type { IIntegration, IntegrationHealth, IntegrationConfig, IntegrationTestResult } from "./base";

const ID = "rabbitmq";

export const RabbitMQIntegration: IIntegration = {
  id: ID,
  name: "RabbitMQ",
  description: "Job queue for background workers — discovery, enrichment, and AI tasks.",
  capabilities: {
    healthCheck: true,
    testConnection: true,
    metrics: ["queueCount", "messages", "consumers"],
  },

  getDefaultConfig(): IntegrationConfig {
    return {
      id: ID,
      name: "RabbitMQ",
      description: "Job queue for background workers",
      icon: "boxes",
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
    logger.info("integrations.rabbitmq.connect", { baseUrl: config.baseUrl });
  },

  async disconnect(): Promise<void> {
    logger.info("integrations.rabbitmq.disconnect");
  },

  async healthCheck(): Promise<IntegrationHealth> {
    const config = await this.loadConfiguration();
    if (!config?.baseUrl) {
      return {
        status: "disconnected",
        error: "RabbitMQ URL not configured",
        lastChecked: new Date().toISOString(),
      };
    }

    const start = performance.now();
    try {
      const url = new URL(config.baseUrl);
      const host = url.hostname;
      const managementPort = "15672";

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`http://${host}:${managementPort}/api/healthchecks/node`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(config.apiKey ? { Authorization: `Basic ${Buffer.from(`guest:${config.apiKey}`).toString("base64")}` } : {}),
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
      } catch {
        clearTimeout(timeoutHandle);
        throw new Error(`Cannot reach RabbitMQ at ${host}`);
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
      return { success: false, error: "RabbitMQ URL not configured" };
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
      errors.push("RabbitMQ URL is required when RabbitMQ is enabled");
    }

    if (config.baseUrl && !config.baseUrl.startsWith("amqp://") && !config.baseUrl.startsWith("amqps://")) {
      errors.push("RabbitMQ URL must start with amqp:// or amqps://");
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
        name: "RabbitMQ",
        description: this.description,
        icon: "boxes",
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
