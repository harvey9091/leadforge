/**
 * =============================================================================
 * Configuration Management — Phase 8
 * =============================================================================
 *
 * Centralized configuration with:
 *  - Strong validation
 *  - Default profiles (development, production, testing)
 *  - Environment-specific overrides
 *  - Configuration diagnostics
 *  - Configuration export
 * =============================================================================
 */

export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{ key: string; message: string }>;
  warnings: Array<{ key: string; message: string }>;
  config: Record<string, unknown>;
}

export type ConfigProfile = "development" | "production" | "testing";

const REQUIRED_VARS = [
  "DATABASE_URL",
  "JWT_SECRET",
];

const RECOMMENDED_VARS = [
  "FIRECRAWL_API_URL",
  "AI_MODEL",
  "AI_TEMPERATURE",
  "AI_MAX_TOKENS",
  "AI_TIMEOUT",
  "AI_RETRIES",
];

const SENSITIVE_VARS = [
  "JWT_SECRET",
  "FIRECRAWL_API_KEY",
  "POSTGRES_PASSWORD",
  "RABBITMQ_PASSWORD",
];

/**
 * Validate the current environment configuration.
 */
export function validateConfig(): ConfigValidationResult {
  const errors: Array<{ key: string; message: string }> = [];
  const warnings: Array<{ key: string; message: string }> = [];
  const config: Record<string, unknown> = {};

  // Check required variables
  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value) {
      errors.push({ key, message: `${key} is required but not set` });
    } else {
      config[key] = key === "JWT_SECRET" ? "***redacted***" : value;
    }
  }

  // Check recommended variables
  for (const key of RECOMMENDED_VARS) {
    const value = process.env[key];
    if (!value) {
      warnings.push({ key, message: `${key} is not set — using default` });
    } else {
      config[key] = value;
    }
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push({ key: "JWT_SECRET", message: "JWT_SECRET should be at least 32 characters" });
  }
  if (jwtSecret && (jwtSecret.includes("change") || jwtSecret.includes("secret") || jwtSecret.includes("default"))) {
    warnings.push({ key: "JWT_SECRET", message: "JWT_SECRET appears to be a placeholder — change it for production" });
  }

  // Validate AI configuration
  const aiTemp = process.env.AI_TEMPERATURE;
  if (aiTemp) {
    const temp = parseFloat(aiTemp);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      errors.push({ key: "AI_TEMPERATURE", message: "Must be a number between 0 and 2" });
    }
  }

  const aiTimeout = process.env.AI_TIMEOUT;
  if (aiTimeout) {
    const timeout = parseInt(aiTimeout, 10);
    if (isNaN(timeout) || timeout < 5000) {
      warnings.push({ key: "AI_TIMEOUT", message: "AI_TIMEOUT below 5000ms may cause premature timeouts" });
    }
  }

  // Check NODE_ENV
  const nodeEnv = process.env.NODE_ENV ?? "development";
  config.NODE_ENV = nodeEnv;
  if (nodeEnv === "production") {
    if (!process.env.POSTGRES_PASSWORD) {
      warnings.push({ key: "POSTGRES_PASSWORD", message: "Not set — required for production PostgreSQL" });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

/**
 * Get the current configuration profile.
 */
export function getProfile(): ConfigProfile {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "testing";
  return "development";
}

/**
 * Get configuration diagnostics for the System page.
 */
export function getConfigDiagnostics(): {
  profile: ConfigProfile;
  nodeVersion: string;
  platform: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  envVarCount: number;
  configuredVars: string[];
  missingRequired: string[];
  missingRecommended: string[];
} {
  const validation = validateConfig();

  return {
    profile: getProfile(),
    nodeVersion: typeof process !== "undefined" ? process.version : "unknown",
    platform: typeof process !== "undefined" ? process.platform : "unknown",
    uptime: typeof process !== "undefined" ? process.uptime() : 0,
    memoryUsage: typeof process !== "undefined" ? process.memoryUsage() : { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 } as NodeJS.MemoryUsage,
    envVarCount: Object.keys(process.env ?? {}).length,
    configuredVars: [...REQUIRED_VARS, ...RECOMMENDED_VARS].filter((k) => process.env[k]),
    missingRequired: validation.errors.map((e) => e.key),
    missingRecommended: validation.warnings.map((w) => w.key),
  };
}

/**
 * Export configuration (with secrets redacted).
 */
export function exportConfig(): Record<string, unknown> {
  const allVars = [...REQUIRED_VARS, ...RECOMMENDED_VARS];
  const exported: Record<string, unknown> = {};

  for (const key of allVars) {
    const value = process.env[key];
    if (value) {
      exported[key] = SENSITIVE_VARS.includes(key) ? "***redacted***" : value;
    }
  }

  exported.NODE_ENV = process.env.NODE_ENV ?? "development";
  exported._exportedAt = new Date().toISOString();
  exported._version = "8.0.0-phase8";

  return exported;
}
