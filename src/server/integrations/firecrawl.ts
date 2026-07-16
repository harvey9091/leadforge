/**
 * =============================================================================
 * Firecrawl Integration
 * =============================================================================
 *
 * Connects to a Firecrawl instance (running on Server 2).
 * Uses an intelligent discovery flow instead of hardcoded endpoints:
 *
 *   1. GET {baseUrl}              — if response identifies itself as Firecrawl → done
 *   2. GET {baseUrl}/openapi.json — if valid OpenAPI spec → success
 *   3. GET {baseUrl}/docs         — if Swagger UI page → success
 *   4. GET {baseUrl}/health       — if 200 → success
 *   5. GET {baseUrl}/version      — if 200 → success
 *
 * API key is optional — required only if the instance has USE_DB_AUTHENTICATION=true.
 * =============================================================================
 */

import { fetchWithRetry } from "@/server/discovery/http-client";
import { logger } from "@/server/utils/logger";
import {
  classifyHttpError,
  classifyNetworkError,
  type DiagnosticResult,
} from "@/server/integrations/diagnostics";
import type {
  IIntegration,
  IntegrationHealth,
  IntegrationConfig,
  IntegrationTestResult,
  DiscoveredModel,
} from "./base";

const ID = "firecrawl";

const FIRECRAWL_IDENTITY_MARKERS = [
  "firecrawl",
  "scrape",
  "crawl",
  "Firecrawl API",
];

const PROBE_PATHS = [
  "",
  "/openapi.json",
  "/docs",
  "/health",
  "/version",
];

function isFirecrawlResponse(body: string, status: number): boolean {
  if (status === 200) {
    const lower = body.toLowerCase();
    return FIRECRAWL_IDENTITY_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
  }
  return false;
}

function looksLikeApiSpec(body: string): boolean {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null && ("openapi" in parsed || "swagger" in parsed);
  } catch {
    return false;
  }
}

function looksLikeSwaggerPage(body: string): boolean {
  return body.includes("swagger") || body.includes("redoc") || body.includes("swagger-ui");
}

const capabilities = {
  healthCheck: true,
  testConnection: true,
  requiresAuth: false,
  metrics: ["latencyMs", "version", "documentationUrl", "authRequired"],
} as const;

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
      const result = await probeFirecrawl(config.baseUrl, config.apiKey, config.timeout);
      const latencyMs = Math.round(performance.now() - start);

      if (result.error) {
        return {
          status: "error",
          latencyMs,
          error: result.error.message,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: "connected",
        latencyMs,
        version: result.version,
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
      return { success: false, error: "Firecrawl URL not configured — enter a Base URL in the Configure dialog" };
    }

    const start = performance.now();
    try {
      const result = await probeFirecrawl(config.baseUrl, config.apiKey, config.timeout);
      const latencyMs = Math.round(performance.now() - start);

      if (result.error) {
        return {
          success: false,
          latencyMs,
          error: result.error.message,
          details: {
            httpStatus: result.httpStatus,
            statusText: result.statusText,
            documentationUrl: result.documentationUrl,
            authRequired: result.authRequired,
            probePath: result.probePath,
          },
        };
      }

      return {
        success: true,
        latencyMs,
        version: result.version,
        details: {
          documentationUrl: result.documentationUrl,
          authRequired: result.authRequired,
          probePath: result.probePath,
        },
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

  validate(config: Partial<IntegrationConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.enabled && !config.baseUrl) {
      errors.push("Base URL is required when Firecrawl is enabled");
    }

    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push("Base URL must be a valid URL (e.g. http://68.233.114.213:3003)");
      }
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      errors.push("Timeout must be between 1000ms and 300000ms");
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

  async discoverModels(_config?: Partial<IntegrationConfig>): Promise<DiscoveredModel[]> {
    return [];
  },
};

interface ProbeResult {
  error?: ReturnType<typeof classifyHttpError>;
  httpStatus: number;
  statusText: string;
  version?: string;
  documentationUrl?: string;
  authRequired: boolean;
  probePath: string;
}

async function probeFirecrawl(
  baseUrl: string,
  apiKey: string | undefined,
  timeout: number
): Promise<ProbeResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

  for (const path of PROBE_PATHS) {
    const url = new URL(path || "/", baseUrl).toString();
    const probePath = path || "/ (root)";

    logger.debug("integrations.firecrawl.probe", { url });

    try {
      const result = await fetchWithRetry(url, {
        method: "GET",
        timeoutMs: Math.min(timeout, 10000),
        maxRetries: 1,
        headers,
        responseType: "json",
        allowStatuses: [200, 401, 403, 404],
      });

      if (result.ok && path === "") {
        const bodyStr = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
        if (isFirecrawlResponse(bodyStr, result.status)) {
          const version = extractVersion(result.body);
          const docUrl = extractDocumentationUrl(result.body);
          return {
            httpStatus: result.status,
            statusText: result.statusText,
            version,
            documentationUrl: docUrl,
            authRequired: false,
            probePath,
          };
        }
      }

      if (result.ok && path === "/openapi.json") {
        const bodyStr = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
        if (looksLikeApiSpec(bodyStr)) {
          const version = extractVersion(result.body);
          return {
            httpStatus: result.status,
            statusText: result.statusText,
            version,
            documentationUrl: url,
            authRequired: false,
            probePath,
          };
        }
      }

      if (result.ok && path === "/docs") {
        const bodyStr = typeof result.body === "string" ? result.body : "";
        if (looksLikeSwaggerPage(bodyStr)) {
          return {
            httpStatus: result.status,
            statusText: result.statusText,
            documentationUrl: url,
            authRequired: false,
            probePath,
          };
        }
      }

      if (result.ok && (path === "/health" || path === "/version")) {
        const version = extractVersion(result.body);
        return {
          httpStatus: result.status,
          statusText: result.statusText,
          version,
          authRequired: false,
          probePath,
        };
      }

      if (result.status === 401 || result.status === 403) {
        return {
          error: classifyHttpError(result.status, result.statusText, typeof result.body === "string" ? result.body : undefined, ID),
          httpStatus: result.status,
          statusText: result.statusText,
          authRequired: true,
          probePath,
        };
      }

      if (result.status === 404 && path !== "") {
        continue;
      }
    } catch (err) {
      if (path === PROBE_PATHS[PROBE_PATHS.length - 1]) {
        const classified = classifyNetworkError(err, ID);
        return {
          error: classified,
          httpStatus: 0,
          statusText: classified.message,
          authRequired: false,
          probePath,
        };
      }
      continue;
    }
  }

  return {
    error: classifyHttpError(404, "Not Found — no valid Firecrawl endpoint found", undefined, ID),
    httpStatus: 404,
    statusText: "Not Found — no valid Firecrawl endpoint found",
    authRequired: false,
    probePath: PROBE_PATHS.join(", "),
  };
}

function extractVersion(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.version === "string") return obj.version;
  if (obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.version === "string") return data.version;
  }
  if (typeof obj.data === "string") return undefined;
  return undefined;
}

function extractDocumentationUrl(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.documentation_url === "string") return obj.documentation_url;
  if (typeof obj.docs === "string") return obj.docs;
  return undefined;
}
