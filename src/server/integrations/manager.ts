/**
 * =============================================================================
 * Integration Manager — Central orchestration for all external services
 * =============================================================================
 *
 * The Integration Manager is the single entry point for all external service
 * communication. It:
 *  - Loads/saves configurations from the database
 *  - Runs health checks across all services
 *  - Validates configurations on startup
 *  - Provides connection testing
 *  - Caches health results with TTL
 *  - Never uses hardcoded localhost values
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import type { IIntegration, IntegrationHealth, IntegrationConfig, IntegrationTestResult } from "./base";

type HealthCacheEntry = {
  health: IntegrationHealth;
  timestamp: number;
};

const HEALTH_CACHE_TTL_MS = 30_000;

class IntegrationManager {
  private integrations: Map<string, IIntegration> = new Map();
  private healthCache: Map<string, HealthCacheEntry> = new Map();
  private _initialized = false;

  register(integration: IIntegration): void {
    this.integrations.set(integration.id, integration);
  }

  get(id: string): IIntegration | undefined {
    return this.integrations.get(id);
  }

  getAll(): IIntegration[] {
    return Array.from(this.integrations.values());
  }

  async getAllConfigs(): Promise<IntegrationConfig[]> {
    const results: IntegrationConfig[] = [];
    for (const integration of this.getAll()) {
      const config = await integration.loadConfiguration();
      if (config) results.push(config);
    }
    return results;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const integration of this.getAll()) {
      try {
        const config = await integration.loadConfiguration();
        if (config?.enabled && config.baseUrl) {
          await integration.connect();
          results.push({ id: integration.id, status: "connected" });
        } else {
          results.push({ id: integration.id, status: "skipped" });
        }
      } catch (err) {
        results.push({
          id: integration.id,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this._initialized = true;

    const failed = results.filter((r) => r.status === "error");
    if (failed.length > 0) {
      logger.warn("integrations.initialize.partialFailure", { failures: failed });
    } else {
      logger.info("integrations.initialize.complete", { count: results.length });
    }
  }

  async validateAll(): Promise<Array<{ id: string; valid: boolean; errors: string[]; warning?: string }>> {
    const results: Array<{ id: string; valid: boolean; errors: string[]; warning?: string }> = [];

    for (const integration of this.getAll()) {
      try {
        const config = await integration.loadConfiguration();
        const validation = integration.validate(config || integration.getDefaultConfig());

        if (!validation.valid) {
          results.push({ id: integration.id, valid: false, errors: validation.errors });
        } else if (config?.enabled && !config.baseUrl) {
          results.push({
            id: integration.id,
            valid: true,
            errors: [],
            warning: "Enabled but base URL not configured",
          });
        } else {
          results.push({ id: integration.id, valid: true, errors: [] });
        }
      } catch (err) {
        results.push({
          id: integration.id,
          valid: false,
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }
    }

    return results;
  }

  async checkHealth(id: string, forceRefresh = false): Promise<IntegrationHealth> {
    const integration = this.integrations.get(id);
    if (!integration) {
      return {
        status: "error",
        error: `Unknown integration: ${id}`,
        lastChecked: new Date().toISOString(),
      };
    }

    const cached = this.healthCache.get(id);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < HEALTH_CACHE_TTL_MS) {
      return cached.health;
    }

    try {
      const health = await integration.healthCheck();
      this.healthCache.set(id, { health, timestamp: Date.now() });
      return health;
    } catch (err) {
      const errorHealth: IntegrationHealth = {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        lastChecked: new Date().toISOString(),
      };
      this.healthCache.set(id, { health: errorHealth, timestamp: Date.now() });
      return errorHealth;
    }
  }

  async checkAllHealth(forceRefresh = false): Promise<Map<string, IntegrationHealth>> {
    const results = new Map<string, IntegrationHealth>();

    const checks = this.getAll().map(async (integration) => {
      const health = await this.checkHealth(integration.id, forceRefresh);
      results.set(integration.id, health);
    });

    await Promise.allSettled(checks);
    return results;
  }

  async testConnection(id: string, overrides?: Partial<IntegrationConfig>): Promise<IntegrationTestResult> {
    const integration = this.integrations.get(id);
    if (!integration) {
      return { success: false, error: `Unknown integration: ${id}` };
    }

    try {
      const result = await integration.test(overrides);
      if (result.success) {
        const health = await this.checkHealth(id, true);
        this.healthCache.set(id, {
          health: {
            ...health,
            status: "connected",
            lastSuccessAt: new Date().toISOString(),
            latencyMs: result.latencyMs,
            version: result.version,
          },
          timestamp: Date.now(),
        });
      }
      return result;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async saveConfiguration(id: string, config: IntegrationConfig): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Unknown integration: ${id}`);
    }
    await integration.saveConfiguration(config);
    this.healthCache.delete(id);
  }

  clearCache(): void {
    this.healthCache.clear();
  }
}

export { IntegrationManager };
export const integrationManager = new IntegrationManager();
