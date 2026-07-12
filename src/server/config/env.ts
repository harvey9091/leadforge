/**
 * Server-side environment configuration.
 *
 * Centralized, validated access to environment variables. Throws early on
 * misconfiguration rather than failing silently mid-request.
 *
 * In production (Docker Compose), all of these are provided via the
 * `.env` file mounted into each container.
 */

function required(name: string, fallback?: string): string {
  const value = (typeof process !== "undefined" ? process.env[name] : undefined) ?? fallback;
  if (!value) {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env var: ${name}`);
    }
    return fallback ?? "";
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

const nodeEnv = (typeof process !== "undefined" ? process.env.NODE_ENV : "development") ?? "development";

export const env = {
  nodeEnv,
  isProd: nodeEnv === "production",
  isDev: nodeEnv !== "production",

  app: {
    name: "Leadforge",
    version: "8.0.0-production",
    url: required("APP_URL", "http://localhost:3000"),
  },

  jwt: {
    secret: required("JWT_SECRET", "dev-only-secret-change-in-production-32chars-min"),
    expiresIn: int("JWT_EXPIRES_IN", 60 * 15),
    refreshExpiresIn: int("JWT_REFRESH_EXPIRES_IN", 60 * 60 * 24 * 30),
    issuer: "leadforge",
    audience: "leadforge-web",
  },

  cookie: {
    name: "lf_session",
    refreshName: "lf_refresh",
    secure: nodeEnv === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  },

  db: {
    url: required("DATABASE_URL", "postgresql://leadforge:leadforge@localhost:5432/leadforge"),
  },

  redis: {
    url: required("REDIS_URL", "redis://localhost:6379"),
  },

  rabbitmq: {
    url: required("RABBITMQ_URL", "amqp://localhost:5672"),
  },

  freellm: {
    baseUrl: required("FREELLM_BASE_URL", ""),
    apiKey: required("FREELLM_API_KEY", ""),
    model: required("FREELLM_MODEL", "default"),
  },

  firecrawl: {
    url: required("FIRECRAWL_URL", ""),
    apiKey: required("FIRECRAWL_API_KEY", ""),
  },

  worker: {
    discoveryCount: int("DISCOVERY_WORKER_COUNT", 2),
    discoveryConcurrency: int("DISCOVERY_CONCURRENCY", 3),
    enrichmentConcurrency: int("ENRICHMENT_CONCURRENCY", 2),
    aiConcurrency: int("AI_CONCURRENCY", 2),
    exportConcurrency: int("EXPORT_CONCURRENCY", 1),
  },

  rateLimit: {
    auth: {
      windowMs: int("RATE_LIMIT_AUTH_WINDOW_MS", 15 * 60 * 1000),
      max: int("RATE_LIMIT_AUTH_MAX", 10),
    },
    api: {
      windowMs: int("RATE_LIMIT_API_WINDOW_MS", 60 * 1000),
      max: int("RATE_LIMIT_API_MAX", 120),
    },
  },
} as const;

export type Env = typeof env;
